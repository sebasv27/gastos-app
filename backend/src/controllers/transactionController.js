const { validationResult } = require('express-validator')
const prisma        = require('../config/prisma')
const alertService  = require('../services/alertService')
const budgetService = require('../services/budgetService')

exports.list = async (req, res) => {
  try {
    const { page=1, limit=30, month, year, categoryId, type, from, to, search } = req.query
    const where = { userId: req.user.id }
    if (month && year) where.date = { gte: new Date(year, month-1, 1), lte: new Date(year, month, 0, 23, 59, 59) }
    else if (from || to) { where.date = {}; if (from) where.date.gte = new Date(from); if (to) where.date.lte = new Date(to) }
    if (categoryId) where.categoryId = categoryId
    if (type) where.type = type
    if (search) where.description = { contains: search, mode: 'insensitive' }
    const skip = (parseInt(page)-1) * parseInt(limit)
    const [total, data] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({ where, include: { category: { select: { id:true, name:true, icon:true, color:true } } }, orderBy: { date: 'desc' }, skip, take: parseInt(limit) })
    ])
    res.json({ data, pagination: { total, page: parseInt(page), pages: Math.ceil(total/parseInt(limit)), limit: parseInt(limit) } })
  } catch { res.status(500).json({ error: 'Error al obtener transacciones' }) }
}

exports.create = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
  try {
    const { amount, description, categoryId, type='EXPENSE', date, notes, source='MANUAL' } = req.body
    const transaction = await prisma.transaction.create({
      data: { amount: parseFloat(amount), description, categoryId, type, date: date ? new Date(date) : new Date(), notes, source, userId: req.user.id },
      include: { category: true }
    })
    if (type === 'EXPENSE' && categoryId) {
      await budgetService.updateSpent(req.user.id, categoryId, transaction.date)
      await alertService.checkBudgetAlerts(req.user.id, categoryId, transaction.date)
    }
    res.status(201).json({ data: transaction })
  } catch (err) { res.status(500).json({ error: 'Error al crear transacción' }) }
}

exports.getOne = async (req, res) => {
  try {
    const t = await prisma.transaction.findFirst({ where: { id: req.params.id, userId: req.user.id }, include: { category: true } })
    if (!t) return res.status(404).json({ error: 'No encontrada' })
    res.json({ data: t })
  } catch { res.status(500).json({ error: 'Error' }) }
}

exports.update = async (req, res) => {
  try {
    const { amount, description, categoryId, type, date, notes } = req.body
    const t = await prisma.transaction.updateMany({ where: { id: req.params.id, userId: req.user.id }, data: { ...(amount && { amount: parseFloat(amount) }), ...(description && { description }), ...(categoryId && { categoryId }), ...(type && { type }), ...(date && { date: new Date(date) }), ...(notes !== undefined && { notes }) } })
    if (t.count === 0) return res.status(404).json({ error: 'No encontrada' })
    res.json({ message: 'Actualizado' })
  } catch { res.status(500).json({ error: 'Error' }) }
}

exports.remove = async (req, res) => {
  try { await prisma.transaction.deleteMany({ where: { id: req.params.id, userId: req.user.id } }); res.json({ message: 'Eliminado' }) }
  catch { res.status(500).json({ error: 'Error' }) }
}

exports.exportCSV = async (req, res) => {
  try {
    const { month, year } = req.query
    const where = { userId: req.user.id }
    if (month && year) where.date = { gte: new Date(year, month-1, 1), lte: new Date(year, month, 0, 23, 59, 59) }
    const data = await prisma.transaction.findMany({ where, include: { category: { select: { name: true } } }, orderBy: { date: 'desc' } })
    const lines = ['Fecha,Descripción,Categoría,Monto,Tipo']
    data.forEach(t => lines.push(`${t.date.toISOString().split('T')[0]},"${t.description}","${t.category?.name||''}",${t.amount},${t.type}`))
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename=gastos.csv')
    res.send('\uFEFF' + lines.join('\n'))
  } catch { res.status(500).json({ error: 'Error al exportar' }) }
}
