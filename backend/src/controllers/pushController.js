// backend/src/controllers/pushController.js
const prisma = require('../config/prisma')
const push = require('../services/pushService')

const CAMPOS = ['budget', 'habits', 'debts', 'gym', 'weekly']
const fallo = (res, err) => { console.error(err); res.status(500).json({ error: 'Error' }) }

exports.publicKey = (req, res) => {
  const k = push.publicKey()
  if (!k) return res.status(503).json({ error: 'Las notificaciones aún no están configuradas en el servidor' })
  res.json({ data: k })
}

exports.subscribe = async (req, res) => {
  try {
    const s = req.body.subscription
    if (!s?.endpoint || !s?.keys?.p256dh || !s?.keys?.auth) return res.status(400).json({ error: 'Suscripción inválida' })
    const datos = {
      userId: req.user.id, p256dh: s.keys.p256dh, auth: s.keys.auth,
      userAgent: req.body.userAgent ? String(req.body.userAgent).slice(0, 300) : null,
    }
    await prisma.pushSubscription.upsert({ where: { endpoint: s.endpoint }, update: datos, create: { ...datos, endpoint: s.endpoint } })
    res.status(201).json({ message: 'Suscrito' })
  } catch (err) { fallo(res, err) }
}

exports.unsubscribe = async (req, res) => {
  try {
    if (req.body.endpoint) await prisma.pushSubscription.deleteMany({ where: { endpoint: req.body.endpoint, userId: req.user.id } })
    res.json({ message: 'Desuscrito' })
  } catch (err) { fallo(res, err) }
}

exports.getPrefs = async (req, res) => {
  try {
    const [p, devices] = await Promise.all([
      push.prefsDe(req.user.id),
      prisma.pushSubscription.count({ where: { userId: req.user.id } }),
    ])
    res.json({ data: { ...Object.fromEntries(CAMPOS.map(k => [k, p[k]])), devices } })
  } catch (err) { fallo(res, err) }
}

exports.updatePrefs = async (req, res) => {
  try {
    const data = {}
    for (const k of CAMPOS) if (typeof req.body[k] === 'boolean') data[k] = req.body[k]
    await prisma.notificationPreference.upsert({ where: { userId: req.user.id }, update: data, create: { userId: req.user.id, ...data } })
    res.json({ message: 'Guardado' })
  } catch (err) { fallo(res, err) }
}

exports.test = async (req, res) => {
  try {
    if (!push.configurar()) return res.status(503).json({ error: 'Faltan las llaves VAPID en el servidor' })
    const n = await push.sendToUser(req.user.id, null, {
      title: '🔔 Notificación de prueba', body: 'Las notificaciones funcionan en este dispositivo.',
      url: '/notificaciones', tag: 'test',
    })
    if (!n) return res.status(400).json({ error: 'No hay dispositivos suscritos. Actívalas primero.' })
    res.json({ data: { sent: n } })
  } catch (err) { fallo(res, err) }
}
