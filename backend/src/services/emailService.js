const nodemailer = require('nodemailer')
const logger = require('../config/logger')
const transporter = nodemailer.createTransport({ host:process.env.SMTP_HOST, port:parseInt(process.env.SMTP_PORT||'587'), secure:false, auth:{ user:process.env.SMTP_USER, pass:process.env.SMTP_PASS } })
const fmt = n => n.toLocaleString('es-CO', { style:'currency', currency:'COP', maximumFractionDigits:0 })
exports.sendBudgetAlert = async (user, budget, pct) => {
  if (!process.env.SMTP_USER) return
  const isExceeded = pct >= 1, color = isExceeded ? '#A32D2D' : '#854F0B', emoji = isExceeded ? '⚠️' : '🔔'
  const title = isExceeded ? `Superaste el presupuesto de ${budget.category.name}` : `Llevas el ${Math.round(pct*100)}% del presupuesto de ${budget.category.name}`
  try {
    await transporter.sendMail({ from:process.env.EMAIL_FROM, to:user.email, subject:`${emoji} ${title}`,
      html:`<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px"><h2 style="color:${color}">${emoji} ${title}</h2><p>Hola <strong>${user.name}</strong>,</p><p>Presupuesto: ${fmt(budget.amount)} | Gastado: ${fmt(budget.spent)}</p></div>` })
  } catch (err) { logger.error('Email error: ' + err.message) }
}
exports.sendWeeklySummary = async (user, summary) => {
  if (!process.env.SMTP_USER) return
  try {
    await transporter.sendMail({ from:process.env.EMAIL_FROM, to:user.email, subject:'📊 Tu resumen semanal de gastos',
      html:`<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px"><h2>📊 Resumen semanal</h2><p>Hola <strong>${user.name}</strong>,</p><p>Total esta semana: <strong>${fmt(summary.totalWeek)}</strong></p></div>` })
  } catch (err) { logger.error('Email error: ' + err.message) }
}
