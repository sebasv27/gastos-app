// backend/src/controllers/forecastController.js
const svc = require('../services/forecastService')

const fallo = (res, err) => {
  if (/429|rate limit/i.test(err.message)) {
    return res.status(429).json({ error: 'La IA está ocupada en este momento. Intenta de nuevo en un minuto.' })
  }
  console.error(err)
  res.status(500).json({ error: 'Error' })
}

exports.get = async (req, res) => {
  try { res.json({ data: await svc.forecast(req.user.id) }) } catch (err) { fallo(res, err) }
}
exports.insights = async (req, res) => {
  try { res.json({ data: await svc.insights(req.user.id, false) }) } catch (err) { fallo(res, err) }
}
exports.refreshInsights = async (req, res) => {
  try { res.json({ data: await svc.insights(req.user.id, true) }) } catch (err) { fallo(res, err) }
}
