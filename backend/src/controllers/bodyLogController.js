const prisma = require('../config/prisma')
const { recalcAndSave } = require('./fitnessProfileController')

exports.list = async (req, res) => {
  try {
    const { days=90 } = req.query
    const data = await prisma.bodyLog.findMany({ where: { userId: req.user.id, date: { gte: new Date(Date.now()-parseInt(days)*24*60*60*1000) } }, orderBy: { date: 'asc' } })
    res.json({ data })
  } catch { res.status(500).json({ error: 'Error' }) }
}

exports.create = async (req, res) => {
  try {
    const { weightKg, bodyFatPct, notes, date } = req.body
    if (!weightKg || weightKg <= 0) return res.status(400).json({ error: 'Peso inválido' })
    const log = await prisma.bodyLog.create({ data: { weightKg: parseFloat(weightKg), bodyFatPct: bodyFatPct ? parseFloat(bodyFatPct) : null, notes, date: date ? new Date(date) : new Date(), userId: req.user.id } })
    const profile = await prisma.fitnessProfile.findUnique({ where: { userId: req.user.id } })
    if (profile) { try { await recalcAndSave(req.user.id, profile) } catch {} }
    res.status(201).json({ data: log })
  } catch { res.status(500).json({ error: 'Error' }) }
}

exports.remove = async (req, res) => {
  try { await prisma.bodyLog.deleteMany({ where: { id: req.params.id, userId: req.user.id } }); res.json({ message: 'Eliminado' }) }
  catch { res.status(500).json({ error: 'Error' }) }
}

exports.getProgress = async (req, res) => {
  try {
    const { days=90 } = req.query
    const logs = await prisma.bodyLog.findMany({ where: { userId: req.user.id, date: { gte: new Date(Date.now()-parseInt(days)*24*60*60*1000) } }, orderBy: { date: 'asc' } })
    if (!logs.length) return res.json({ data: { logs:[], trend:[], delta:null } })
    const trend = logs.map((log, i) => {
      const window = logs.slice(Math.max(0,i-6), i+1)
      const avg = window.reduce((s,l) => s+l.weightKg, 0) / window.length
      return { date: log.date, weightKg: log.weightKg, trendKg: Math.round(avg*10)/10 }
    })
    const delta = { kg: Math.round((logs[logs.length-1].weightKg - logs[0].weightKg)*10)/10, days: Math.round((new Date(logs[logs.length-1].date) - new Date(logs[0].date))/(1000*60*60*24)) }
    res.json({ data: { logs, trend, delta } })
  } catch { res.status(500).json({ error: 'Error' }) }
}
