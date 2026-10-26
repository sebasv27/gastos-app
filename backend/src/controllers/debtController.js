// backend/src/controllers/debtController.js
const prisma = require('../config/prisma')
const svc = require('../services/debtService')

const DIRS = ['I_OWE', 'OWED_TO_ME']
const TYPES = ['CREDIT_CARD', 'LOAN', 'PERSONAL', 'MORTGAGE', 'VEHICLE', 'OTHER']
const RATES = ['EA', 'MONTHLY']
const num = v => (v === undefined || v === null || v === '' ? null : Number(v))

function datos(b) {
  const d = {}
  if (b.name !== undefined) d.name = String(b.name).trim()
  if (b.counterparty !== undefined) d.counterparty = b.counterparty ? String(b.counterparty).trim() : null
  if (DIRS.includes(b.direction)) d.direction = b.direction
  if (TYPES.includes(b.type)) d.type = b.type
  if (RATES.includes(b.rateType)) d.rateType = b.rateType
  for (const k of ['principal', 'balance', 'interestRate', 'minPayment']) if (b[k] !== undefined) d[k] = num(b[k])
  if (b.dueDay !== undefined) d.dueDay = b.dueDay ? Math.min(31, Math.max(1, parseInt(b.dueDay))) : null
  if (b.startDate) d.startDate = new Date(b.startDate)
  if (b.notes !== undefined) d.notes = b.notes || null
  return d
}

const fallo = (res, err) => {
  console.error(err)
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Error' })
}

exports.list = async (req, res) => {
  try {
    const debts = await prisma.debt.findMany({
      where: { userId: req.user.id },
      include: { payments: { orderBy: { date: 'desc' } } },
      orderBy: [{ isPaid: 'asc' }, { createdAt: 'desc' }],
    })
    res.json({
      data: debts.map(d => ({ ...d, monthlyInterest: Math.round(d.balance * svc.monthlyRate(d)) })),
      summary: svc.summary(debts),
    })
  } catch (err) { fallo(res, err) }
}

exports.create = async (req, res) => {
  try {
    const d = datos(req.body)
    if (!d.name || !(d.principal > 0)) return res.status(400).json({ error: 'Nombre y monto son obligatorios' })
    if (d.balance === undefined || d.balance === null || isNaN(d.balance)) d.balance = d.principal
    if (d.interestRate === undefined || d.interestRate === null || isNaN(d.interestRate)) d.interestRate = 0
    const debt = await prisma.debt.create({ data: { ...d, isPaid: d.balance <= 0, userId: req.user.id } })
    res.status(201).json({ data: debt })
  } catch (err) { fallo(res, err) }
}

exports.update = async (req, res) => {
  try {
    const d = datos(req.body)
    if (d.interestRate === null) d.interestRate = 0
    if (d.principal === null) delete d.principal
    if (d.balance === null) delete d.balance
    if (typeof d.balance === 'number') { d.isPaid = d.balance <= 0; d.paidAt = d.balance <= 0 ? new Date() : null }
    const r = await prisma.debt.updateMany({ where: { id: req.params.id, userId: req.user.id }, data: d })
    if (!r.count) return res.status(404).json({ error: 'No encontrada' })
    res.json({ message: 'Actualizada' })
  } catch (err) { fallo(res, err) }
}

exports.remove = async (req, res) => {
  try {
    const okBorrado = await svc.removeDebt({ userId: req.user.id, debtId: req.params.id })
    if (!okBorrado) return res.status(404).json({ error: 'No encontrada' })
    res.json({ message: 'Eliminada' })
  } catch (err) { fallo(res, err) }
}

exports.addPayment = async (req, res) => {
  try {
    const debt = await prisma.debt.findFirst({ where: { id: req.params.id, userId: req.user.id } })
    if (!debt) return res.status(404).json({ error: 'No encontrada' })
    const p = await svc.addPayment({ userId: req.user.id, debt, amount: req.body.amount, date: req.body.date, notes: req.body.notes })
    res.status(201).json({ data: p })
  } catch (err) { fallo(res, err) }
}

exports.removePayment = async (req, res) => {
  try {
    const okBorrado = await svc.removePayment({ userId: req.user.id, paymentId: req.params.paymentId })
    if (!okBorrado) return res.status(404).json({ error: 'No encontrado' })
    res.json({ message: 'Eliminado' })
  } catch (err) { fallo(res, err) }
}

exports.plan = async (req, res) => {
  try {
    const debts = await prisma.debt.findMany({ where: { userId: req.user.id, isPaid: false, direction: 'I_OWE' } })
    const extra = Math.max(0, Number(req.query.extra) || 0)
    res.json({ data: {
      avalanche: svc.simulate(debts, extra, 'avalanche'),
      snowball: svc.simulate(debts, extra, 'snowball'),
      minimumOnly: svc.simulate(debts, 0, 'avalanche'),
    } })
  } catch (err) { fallo(res, err) }
}

exports.advice = async (req, res) => {
  try {
    res.json({ data: await svc.generateAdvice(req.user.id) })
  } catch (err) {
    if (/429|rate limit/i.test(err.message)) {
      return res.status(429).json({ error: 'La IA está ocupada en este momento. Intenta de nuevo en un minuto.' })
    }
    fallo(res, err)
  }
}

exports.latestAdvice = async (req, res) => {
  try {
    const a = await prisma.financialAdvice.findFirst({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } })
    res.json({ data: a })
  } catch (err) { fallo(res, err) }
}

exports.sendTelegram = async (req, res) => {
  try {
    const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { telegramChatId: true } })
    if (!u?.telegramChatId) return res.status(400).json({ error: 'Primero vincula tu cuenta de Telegram' })
    await svc.weeklySummary(req.user.id, u.telegramChatId)
    res.json({ message: 'Enviado' })
  } catch (err) { fallo(res, err) }
}
