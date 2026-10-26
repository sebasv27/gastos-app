// backend/src/controllers/reportController.js
const prisma = require('../config/prisma')
const svc = require('../services/reportService')

function parseMes(q) {
  const actual = svc.mesActual()
  const y = parseInt(q.year) || actual.y
  const m = parseInt(q.month) || actual.m
  if (m < 1 || m > 12 || y < 2000 || y > 2100) return null
  return { y, m }
}

exports.download = async (req, res) => {
  try {
    const p = parseMes(req.query)
    if (!p) return res.status(400).json({ error: 'Mes inválido' })
    const pdf = await svc.monthlyReport(req.user.id, p.y, p.m, { ia: req.query.ia !== '0' })
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${svc.nombreArchivo(p.y, p.m)}"`,
      'Content-Length': pdf.length,
    })
    res.send(pdf)
  } catch (err) { console.error(err); res.status(500).json({ error: 'No se pudo generar el reporte' }) }
}

exports.telegram = async (req, res) => {
  try {
    const p = parseMes(req.query)
    if (!p) return res.status(400).json({ error: 'Mes inválido' })
    const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { telegramChatId: true } })
    if (!u?.telegramChatId) return res.status(400).json({ error: 'Primero vincula tu cuenta de Telegram' })
    await svc.sendReportTelegram(req.user.id, u.telegramChatId, p.y, p.m)
    res.json({ message: 'Enviado' })
  } catch (err) {
    console.error(err)
    res.status(err.status || 500).json({ error: err.status ? err.message : 'No se pudo enviar el reporte' })
  }
}
