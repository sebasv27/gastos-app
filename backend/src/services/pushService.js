// backend/src/services/pushService.js
// Notificaciones Web Push: envío, preferencias por usuario y recordatorios programados.
const webpush = require('web-push')
const prisma = require('../config/prisma')
const logger = require('../config/logger')

const OFFSET_MS = 5 * 3600e3 // Colombia: UTC-5
const URLS = {"habits": "/productividad/habitos", "debts": "/deudas", "records": "/fitness/records", "budgets": "/presupuestos"}
const fmt = n => `$${Math.round(n || 0).toLocaleString('es-CO')}`

let listo = null
function configurar() {
  if (listo !== null) return listo
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) { logger.warn('Push: faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY en el .env'); listo = false; return false }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub, priv)
  listo = true
  return true
}

const publicKey = () => process.env.VAPID_PUBLIC_KEY || null

async function prefsDe(userId) {
  return prisma.notificationPreference.upsert({ where: { userId }, update: {}, create: { userId } })
}

/** Envía a todos los dispositivos del usuario. kind = tipo de preferencia (null = siempre). */
async function sendToUser(userId, kind, { title, body, url = '/', tag } = {}) {
  if (!configurar()) return 0
  if (kind) {
    const p = await prefsDe(userId)
    if (p[kind] === false) return 0
  }
  const subs = await prisma.pushSubscription.findMany({ where: { userId } })
  const payload = JSON.stringify({ title, body, url, tag, icon: '/icon-192.png' })
  let enviados = 0
  await Promise.all(subs.map(async s => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 12 * 3600 })
      enviados++
      await prisma.pushSubscription.update({ where: { id: s.id }, data: { lastUsedAt: new Date() } })
    } catch (err) {
      // 404/410: la suscripción ya no existe (desinstalaron o revocaron el permiso)
      if (err.statusCode === 404 || err.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {})
      } else {
        logger.error(`Push (${err.statusCode || '?'}): ${err.message}`)
      }
    }
  }))
  return enviados
}

/** Igual que sendToUser, pero sin bloquear ni lanzar errores (para usar dentro de otros flujos) */
function notify(userId, kind, payload) {
  return sendToUser(userId, kind, payload).catch(err => { logger.error('Push notify: ' + err.message); return 0 })
}

// ---------- Recordatorio de hábitos (se llama cada minuto) ----------
const enviadosHoy = new Set()
async function checkHabitReminders() {
  if (!configurar()) return
  const b = new Date(Date.now() - OFFSET_MS)
  const hhmm = b.toISOString().slice(11, 16)
  const hoy = b.toISOString().slice(0, 10)
  const g = b.getUTCDay()
  const dow = g === 0 ? 7 : g
  const inicio = new Date(`${hoy}T05:00:00Z`)
  const fin = new Date(inicio.getTime() + 864e5 - 1)

  const habits = await prisma.habit.findMany({
    where: { isActive: true, reminderTime: hhmm },
    include: { logs: { where: { date: { gte: inicio, lte: fin }, completed: true }, select: { id: true } } },
  })
  for (const h of habits) {
    const key = `${h.id}|${hoy}`
    if (enviadosHoy.has(key) || h.logs.length) continue
    let target = [1, 2, 3, 4, 5, 6, 7]
    try { target = (Array.isArray(h.targetDays) ? h.targetDays : JSON.parse(h.targetDays)).map(Number) } catch {}
    if (!target.includes(dow)) continue
    enviadosHoy.add(key)
    await notify(h.userId, 'habits', {
      title: `${h.emoji} ${h.name}`,
      body: 'Es hora de tu hábito. Márcalo cuando lo completes ✅',
      url: URLS.habits, tag: `habit-${h.id}`,
    })
  }
  if (enviadosHoy.size > 1000) enviadosHoy.clear()
}

// ---------- Pagos de deudas de mañana (cron diario 8 a. m.) ----------
async function checkDebtReminders() {
  if (!configurar()) return
  const manana = new Date(Date.now() - OFFSET_MS + 864e5)
  const dia = manana.getUTCDate()
  const ultimo = new Date(Date.UTC(manana.getUTCFullYear(), manana.getUTCMonth() + 1, 0)).getUTCDate()
  const debts = await prisma.debt.findMany({ where: { direction: 'I_OWE', isPaid: false, dueDay: { not: null } } })
  for (const d of debts) {
    // Si el día de pago no existe este mes (ej. 31 en noviembre), se avisa el último día
    if (!(d.dueDay === dia || (dia === ultimo && d.dueDay > ultimo))) continue
    await notify(d.userId, 'debts', {
      title: `💳 Mañana pagas: ${d.name}`,
      body: d.minPayment ? `Cuota de ${fmt(d.minPayment)} · saldo ${fmt(d.balance)}` : `Saldo pendiente: ${fmt(d.balance)}`,
      url: URLS.debts, tag: `debt-${d.id}`,
    })
  }
}

// ---------- Resumen semanal (cron domingo 7 p. m.) ----------
async function sendWeeklyPush() {
  if (!configurar()) return
  const users = await prisma.pushSubscription.findMany({ distinct: ['userId'], select: { userId: true } })
  const hace7 = new Date(Date.now() - 7 * 864e5)
  for (const { userId } of users) {
    try {
      const [g, entrenos] = await Promise.all([
        prisma.transaction.aggregate({ where: { userId, type: 'EXPENSE', date: { gte: hace7 } }, _sum: { amount: true } }),
        prisma.workoutSession.count({ where: { userId, finishedAt: { gte: hace7 } } }),
      ])
      let habitos = null
      try { habitos = (await require('./habitStatsService').userHabitStats(userId)).summary.weekRate } catch {}
      const partes = [`Gastaste ${fmt(g._sum.amount)}`, `${entrenos} entreno${entrenos === 1 ? '' : 's'}`]
      if (habitos !== null) partes.push(`${habitos}% de hábitos`)
      await notify(userId, 'weekly', { title: '📊 Tu semana', body: partes.join(' · '), url: '/', tag: 'weekly' })
    } catch (err) { logger.error('Push semanal: ' + err.message) }
  }
}

module.exports = {
  configurar, publicKey, prefsDe, sendToUser, notify,
  checkHabitReminders, checkDebtReminders, sendWeeklyPush, URLS,
}
