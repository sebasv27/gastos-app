const prisma  = require('../config/prisma')
const logger  = require('../config/logger')

exports.list = async (req, res) => {
  try {
    const { status, priority, date } = req.query
    const where = { userId: req.user.id }
    if (status)   where.status   = status
    if (priority) where.priority = priority
    if (date) {
      const d = new Date(date); d.setHours(0,0,0,0)
      const e = new Date(date); e.setHours(23,59,59,999)
      where.dueDate = { gte: d, lte: e }
    }
    const data = await prisma.task.findMany({ where, orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }] })
    res.json({ data })
  } catch { res.status(500).json({ error: 'Error al obtener tareas' }) }
}

exports.create = async (req, res) => {
  try {
    const { title, description, priority, dueDate, dueTime, tags } = req.body
    if (!title) return res.status(400).json({ error: 'Título requerido' })
    const task = await prisma.task.create({
      data: { title, description, priority: priority||'MEDIUM', dueDate: dueDate ? new Date(dueDate) : null, dueTime, tags: tags||[], userId: req.user.id }
    })
    res.status(201).json({ data: task })
  } catch (err) { res.status(500).json({ error: err.message }) }
}

exports.update = async (req, res) => {
  try {
    const { title, description, priority, status, dueDate, dueTime, tags } = req.body
    const data = {}
    if (title !== undefined)       data.title       = title
    if (description !== undefined) data.description = description
    if (priority !== undefined)    data.priority    = priority
    if (dueDate !== undefined)     data.dueDate     = dueDate ? new Date(dueDate) : null
    if (dueTime !== undefined)     data.dueTime     = dueTime
    if (tags !== undefined)        data.tags        = tags
    if (status !== undefined) {
      data.status = status
      data.completedAt = status === 'COMPLETED' ? new Date() : null
    }
    const r = await prisma.task.updateMany({ where: { id: req.params.id, userId: req.user.id }, data })
    if (r.count === 0) return res.status(404).json({ error: 'No encontrada' })
    res.json({ message: 'Actualizada' })
  } catch (err) { res.status(500).json({ error: err.message }) }
}

exports.complete = async (req, res) => {
  try {
    const task = await prisma.task.findFirst({ where: { id: req.params.id, userId: req.user.id } })
    if (!task) return res.status(404).json({ error: 'No encontrada' })
    const newStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED'
    await prisma.task.update({ where: { id: req.params.id }, data: { status: newStatus, completedAt: newStatus === 'COMPLETED' ? new Date() : null } })
    res.json({ message: newStatus === 'COMPLETED' ? 'Completada' : 'Reabierta' })
  } catch { res.status(500).json({ error: 'Error' }) }
}

exports.remove = async (req, res) => {
  try { await prisma.task.deleteMany({ where: { id: req.params.id, userId: req.user.id } }); res.json({ message: 'Eliminada' }) }
  catch { res.status(500).json({ error: 'Error' }) }
}

exports.getTodaySummary = async (req, res) => {
  try {
    const start = new Date(); start.setHours(0,0,0,0)
    const end   = new Date(); end.setHours(23,59,59,999)
    const [pending, completed, overdue] = await Promise.all([
      prisma.task.count({ where: { userId: req.user.id, status: 'PENDING', OR: [{ dueDate: null }, { dueDate: { gte: start, lte: end } }] } }),
      prisma.task.count({ where: { userId: req.user.id, status: 'COMPLETED', completedAt: { gte: start } } }),
      prisma.task.count({ where: { userId: req.user.id, status: 'PENDING', dueDate: { lt: start } } })
    ])
    const tasks = await prisma.task.findMany({ where: { userId: req.user.id, status: { in: ['PENDING','IN_PROGRESS'] }, OR: [{ dueDate: null }, { dueDate: { gte: start, lte: end } }] }, orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }], take: 5 })
    res.json({ data: { pending, completed, overdue, tasks } })
  } catch { res.status(500).json({ error: 'Error' }) }
}
