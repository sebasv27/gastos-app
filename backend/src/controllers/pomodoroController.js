const prisma = require('../config/prisma')

exports.list = async (req, res) => {
  try {
    const { limit=20 } = req.query
    const data = await prisma.pomodoroSession.findMany({ where: { userId: req.user.id }, orderBy: { startedAt: 'desc' }, take: parseInt(limit) })
    res.json({ data })
  } catch { res.status(500).json({ error: 'Error' }) }
}

exports.create = async (req, res) => {
  try {
    const { title, workMinutes, breakMinutes, rounds, totalMinutes, taskId } = req.body
    const session = await prisma.pomodoroSession.create({
      data: { title: title||'Sesión de trabajo', workMinutes: workMinutes||25, breakMinutes: breakMinutes||5, rounds: rounds||0, totalMinutes: totalMinutes||0, taskId: taskId||null, finishedAt: new Date(), userId: req.user.id }
    })
    res.status(201).json({ data: session })
  } catch (err) { res.status(500).json({ error: err.message }) }
}

exports.getStats = async (req, res) => {
  try {
    const { days=7 } = req.query
    const since = new Date(Date.now() - parseInt(days)*24*60*60*1000)
    const sessions = await prisma.pomodoroSession.findMany({ where: { userId: req.user.id, startedAt: { gte: since }, status: 'COMPLETED' } })
    const totalMinutes = sessions.reduce((s,p) => s+p.totalMinutes, 0)
    const totalRounds  = sessions.reduce((s,p) => s+p.rounds, 0)
    const byDay = {}
    sessions.forEach(s => {
      const day = new Date(s.startedAt).toISOString().split('T')[0]
      byDay[day] = (byDay[day]||0) + s.totalMinutes
    })
    res.json({ data: { totalSessions: sessions.length, totalMinutes, totalRounds, avgMinutesPerDay: Math.round(totalMinutes/parseInt(days)), byDay } })
  } catch { res.status(500).json({ error: 'Error' }) }
}
