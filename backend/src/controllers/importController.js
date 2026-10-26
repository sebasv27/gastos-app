// backend/src/controllers/importController.js
const svc = require('../services/importService')

const fallo = (res, err) => {
  if (/429|rate limit/i.test(err.message)) {
    return res.status(429).json({ error: 'La IA está ocupada leyendo otro extracto. Intenta en un minuto.' })
  }
  if (!err.status || err.status >= 500) console.error('Importación:', err.message)
  res.status(err.status || 500).json({ error: err.status ? err.message : 'No se pudo procesar el archivo', needsPassword: !!err.needsPassword })
}

exports.preview = async (req, res) => {
  try { res.json({ data: await svc.preview(req.user.id, req.file, req.body.password) }) }
  catch (err) { fallo(res, err) }
}

exports.commit = async (req, res) => {
  try { res.status(201).json({ data: { imported: await svc.commit(req.user.id, req.body.rows, req.body.bank) } }) }
  catch (err) { fallo(res, err) }
}
