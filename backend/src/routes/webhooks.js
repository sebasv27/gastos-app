const router   = require('express').Router()
const prisma   = require('../config/prisma')
const jwt      = require('jsonwebtoken')
const alertService        = require('../services/alertService')
const budgetService       = require('../services/budgetService')
const notificationParser  = require('../services/notificationParser')
const autoCategoryService = require('../services/autoCategoryService')
const logger   = require('../config/logger')

const deviceAuth = async (req,res,next) => {
  try {
    const token = req.headers['x-device-token']
    if (!token) return res.status(401).json({ error:'Token requerido' })
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.userId = decoded.id; next()
  } catch { res.status(401).json({ error:'Token inválido' }) }
}

router.post('/notification', deviceAuth, async (req,res) => {
  try {
    const { appPackage, title, text, timestamp } = req.body
    if (!text && !title) return res.status(400).json({ error:'Notificación vacía' })
    const parsed = await notificationParser.parseNotification({ appPackage, title, text, timestamp })
    if (!parsed || parsed.confidence < 0.4) { logger.info('Notificación ignorada: ' + title); return res.json({ ignored:true }) }
    const categoryId = await autoCategoryService.autoDetectCategory(parsed.description, req.userId)
    const transaction = await prisma.transaction.create({ data:{ amount:parsed.amount, description:parsed.description, type:parsed.type, source:'NOTIFICATION', rawNotif:parsed.rawText, date:parsed.timestamp?new Date(parsed.timestamp):new Date(), userId:req.userId, categoryId:categoryId||null }, include:{ category:true } })
    if (categoryId && parsed.type==='EXPENSE') { await budgetService.updateSpent(req.userId, categoryId, transaction.date); await alertService.checkBudgetAlerts(req.userId, categoryId, transaction.date) }
    res.status(201).json({ data:transaction, parsed:{ bank:parsed.bank, type:parsed.type, confidence:parsed.confidence } })
  } catch (err) { logger.error(err.message); res.status(500).json({ error:'Error procesando notificación' }) }
})

router.get('/status', deviceAuth, async (req,res) => {
  const user = await prisma.user.findUnique({ where:{ id:req.userId }, select:{ name:true, email:true } })
  res.json({ connected:true, user, timestamp:new Date() })
})

module.exports = router