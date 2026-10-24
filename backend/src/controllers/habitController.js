const prisma = require('../config/prisma')

exports.list = async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0)
    const end   = new Date(); end.setHours(23,59,59,999)
    const habits = await prisma.habit.findMany({ where: { userId: req.user.id, isActive: true }, include: { logs: { where: { date: { gte: today, lte: end } } } }, orderBy: { createdAt: 'asc' } })
    const data = habits.map(h => ({ ...h, completedToday: h.logs.length > 0 }))
    res.json({ data })
  } catch { res.status(500).json({ error: 'Error' }) }
}

exports.create = async (req, res) => {
  try {
    const { name, emoji, color, frequency, targetDays, reminderTime } = req.body
    if (!name) return res.status(400).json({ error: 'Nombre requerido' })
    const habit = await prisma.habit.create({ data: { name, emoji: emoji||'⭐', color: color||'#0F6E56', frequency: frequency||'DAILY', targetDays: targetDays||[1,2,3,4,5,6,7], reminderTime, userId: req.user.id } })
    res.status(201).json({ data: habit })
  } catch (err) { res.status(500).json({ error: err.message }) }
}

exports.toggle = async (req, res) => {
  try {
    const habit = await prisma.habit.findFirst({ where: { id: req.params.id, userId: req.user.id } })
    if (!habit) return res.status(404).json({ error: 'No encontrado' })
    const today = new Date(); today.setHours(0,0,0,0)
    const end   = new Date(); end.setHours(23,59,59,999)
    const existing = await prisma.habitLog.findFirst({ where: { habitId: habit.id, userId: req.user.id, date: { gte: today, lte: end } } })
    if (existing) {
      await prisma.habitLog.delete({ where: { id: existing.id } })
      await prisma.habit.update({ where: { id: habit.id }, data: { streak: Math.max(0, habit.streak - 1) } })
      res.json({ completed: false, message: 'Desmarcado' })
    } else {
      await prisma.habitLog.create({ data: { habitId: habit.id, userId: req.user.id, date: new Date() } })
      const newStreak = habit.streak + 1
      await prisma.habit.update({ where: { id: habit.id }, data: { streak: newStreak, bestStreak: Math.max(habit.bestStreak, newStreak) } })
      res.json({ completed: true, streak: newStreak, message: '¡Completado! Racha: ' + newStreak })
    }
  } catch (err) { res.status(500).json({ error: err.message }) }
}

exports.getStreak = async (req, res) => {
  try {
    const logs = await prisma.habitLog.findMany({ where: { habitId: req.params.id, userId: req.user.id }, orderBy: { date: 'desc' }, take: 30 })
    res.json({ data: logs })
  } catch { res.status(500).json({ error: 'Error' }) }
}

exports.update = async (req, res) => {
  try {
    const { name, emoji, color, reminderTime, isActive } = req.body
    await prisma.habit.updateMany({ where: { id: req.params.id, userId: req.user.id }, data: { ...(name&&{name}), ...(emoji&&{emoji}), ...(color&&{color}), ...(reminderTime!==undefined&&{reminderTime}), ...(isActive!==undefined&&{isActive}) } })
    res.json({ message: 'Actualizado' })
  } catch { res.status(500).json({ error: 'Error' }) }
}

exports.remove = async (req, res) => {
  try { await prisma.habit.deleteMany({ where: { id: req.params.id, userId: req.user.id } }); res.json({ message: 'Eliminado' }) }
  catch { res.status(500).json({ error: 'Error' }) }
}
