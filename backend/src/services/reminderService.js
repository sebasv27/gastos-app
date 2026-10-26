// reminderService.js — Envía recordatorios por Telegram
const prisma = require('../config/prisma')
const logger = require('../config/logger')
const https  = require('https')

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN

const sendTelegram = (chatId, text) => new Promise((resolve, reject) => {
  const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
  const req  = https.request({
    hostname: 'api.telegram.org',
    path: '/bot' + TELEGRAM_TOKEN + '/sendMessage',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, res => { res.on('data', () => {}); res.on('end', resolve) })
  req.on('error', reject)
  req.write(body); req.end()
})

const checkReminders = async () => {
  try {
    const now      = new Date()
    const nowStr   = now.toTimeString().slice(0,5)
    const dayOfWeek = now.getDay() || 7

    // Por ahora solo log — telegramChatId se activa cuando esté en BD
    await require('./pushService').checkHabitReminders()
  } catch (err) { logger.error('reminderService: ' + err.message) }
}

exports.startReminders = () => {
  logger.info('⏰ Servicio de recordatorios activo')
  setInterval(checkReminders, 60 * 1000)
}
