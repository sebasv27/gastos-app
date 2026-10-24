const prisma = require('../config/prisma')

exports.list = async (req, res) => {
  try {
    const data = await prisma.routineBlock.findMany({ where: { userId: req.user.id, isActive: true }, orderBy: { startTime: 'asc' } })
    res.json({ data })
  } catch { res.status(500).json({ error: 'Error' }) }
}

exports.create = async (req, res) => {
  try {
    const { title, emoji, startTime, endTime, days, color, reminderMin } = req.body
    if (!title || !startTime || !endTime) return res.status(400).json({ error: 'Título, hora inicio y fin requeridos' })
    const block = await prisma.routineBlock.create({ data: { title, emoji: emoji||'📌', startTime, endTime, days: days||[1,2,3,4,5,6,7], color: color||'#185FA5', reminderMin: reminderMin||5, userId: req.user.id } })
    res.status(201).json({ data: block })
  } catch (err) { res.status(500).json({ error: err.message }) }
}

exports.update = async (req, res) => {
  try {
    const { title, emoji, startTime, endTime, days, color, reminderMin, isActive } = req.body
    await prisma.routineBlock.updateMany({ where: { id: req.params.id, userId: req.user.id }, data: { ...(title&&{title}), ...(emoji&&{emoji}), ...(startTime&&{startTime}), ...(endTime&&{endTime}), ...(days&&{days}), ...(color&&{color}), ...(reminderMin!==undefined&&{reminderMin}), ...(isActive!==undefined&&{isActive}) } })
    res.json({ message: 'Actualizado' })
  } catch { res.status(500).json({ error: 'Error' }) }
}

exports.remove = async (req, res) => {
  try { await prisma.routineBlock.deleteMany({ where: { id: req.params.id, userId: req.user.id } }); res.json({ message: 'Eliminado' }) }
  catch { res.status(500).json({ error: 'Error' }) }
}

exports.getTodaySchedule = async (req, res) => {
  try {
    const dayOfWeek = new Date().getDay() || 7 // 1=lunes...7=domingo
    const blocks = await prisma.routineBlock.findMany({ where: { userId: req.user.id, isActive: true } })
    const todayBlocks = blocks.filter(b => Array.isArray(b.days) && b.days.includes(dayOfWeek))
    res.json({ data: todayBlocks.sort((a,b) => a.startTime.localeCompare(b.startTime)) })
  } catch { res.status(500).json({ error: 'Error' }) }
}
