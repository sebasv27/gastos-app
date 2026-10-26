// backend/src/services/reportService.js
// Reporte mensual en PDF (pdfkit): finanzas, presupuestos, deudas, hábitos, entrenos y comentario de la IA.
const https = require('https')
const PDFDocument = require('pdfkit')
const prisma = require('../config/prisma')
const logger = require('../config/logger')
const { epley } = require('./recordService')
const { callClaude, parseJSON } = require('./claudeService')

const OFFSET_MS = 5 * 3600e3
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const VERDE = '#0F6E56', GRIS = '#64748b', OSCURO = '#1e293b', ROJO = '#B42318', CLARO = '#F1F5F9', AMBAR = '#B45309'

const fmt = n => `$${Math.round(n || 0).toLocaleString('es-CO')}`
// Las fuentes estándar del PDF no tienen emojis: se quitan los caracteres fuera de Latin-1
const limpiar = s => String(s ?? '').replace(/[^\x20-\x7E\xA0-\xFF]/g, '').replace(/\s+/g, ' ').trim()
const dayKey = d => new Date(new Date(d).getTime() - OFFSET_MS).toISOString().slice(0, 10)
const addDays = (k, n) => { const d = new Date(`${k}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const isoDow = k => { const g = new Date(`${k}T00:00:00Z`).getUTCDay(); return g === 0 ? 7 : g }
const rango = (y, m) => ({ inicio: new Date(Date.UTC(y, m - 1, 1, 5)), fin: new Date(Date.UTC(y, m, 1, 5)) })
const cap = s => s.charAt(0).toUpperCase() + s.slice(1)

function mesActual() {
  const b = new Date(Date.now() - OFFSET_MS)
  return { y: b.getUTCFullYear(), m: b.getUTCMonth() + 1 }
}

async function datosMes(userId, y, m) {
  const { inicio, fin } = rango(y, m)
  const prev = m === 1 ? rango(y - 1, 12) : rango(y, m - 1)
  const [user, txs, txPrev, budgets, debts, payments, habits, sessions] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    prisma.transaction.findMany({
      where: { userId, date: { gte: inicio, lt: fin }, type: { in: ['INCOME', 'EXPENSE'] } },
      select: { amount: true, type: true, description: true, date: true, category: { select: { name: true, color: true } } },
    }),
    prisma.transaction.groupBy({
      by: ['type'], where: { userId, date: { gte: prev.inicio, lt: prev.fin }, type: { in: ['INCOME', 'EXPENSE'] } }, _sum: { amount: true },
    }),
    prisma.budget.findMany({ where: { userId, month: m, year: y }, include: { category: { select: { name: true } } } }),
    prisma.debt.findMany({ where: { userId } }),
    prisma.debtPayment.findMany({ where: { userId, date: { gte: inicio, lt: fin } }, include: { debt: { select: { direction: true } } } }),
    prisma.habit.findMany({
      where: { userId, isActive: true },
      include: { logs: { where: { date: { gte: inicio, lt: fin }, completed: true }, select: { date: true } } },
    }),
    prisma.workoutSession.findMany({
      where: { userId, startedAt: { gte: inicio, lt: fin } },
      include: { setLogs: { where: { isWarmup: false }, select: { weightKg: true, reps: true, exerciseId: true, exercise: { select: { name: true } } } } },
    }),
  ])

  // Finanzas
  const ingresos = txs.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0)
  const gastosTx = txs.filter(t => t.type === 'EXPENSE')
  const gastos = gastosTx.reduce((s, t) => s + t.amount, 0)
  const gastosPrev = txPrev.find(g => g.type === 'EXPENSE')?._sum.amount || 0
  const porCat = {}
  for (const t of gastosTx) {
    const n = t.category?.name || 'Sin categoría'
    porCat[n] ||= { name: n, color: t.category?.color || GRIS, total: 0 }
    porCat[n].total += t.amount
  }
  const categorias = Object.values(porCat).sort((a, b) => b.total - a.total)
  const topGastos = [...gastosTx].sort((a, b) => b.amount - a.amount).slice(0, 5)

  // Deudas
  const activas = debts.filter(d => !d.isPaid)
  const deudas = {
    debo: activas.filter(d => d.direction === 'I_OWE').reduce((s, d) => s + d.balance, 0),
    meDeben: activas.filter(d => d.direction === 'OWED_TO_ME').reduce((s, d) => s + d.balance, 0),
    abonado: payments.filter(p => p.debt.direction === 'I_OWE').reduce((s, p) => s + p.amount, 0),
    cobrado: payments.filter(p => p.debt.direction === 'OWED_TO_ME').reduce((s, p) => s + p.amount, 0),
    saldadas: debts.filter(d => d.paidAt && d.paidAt >= inicio && d.paidAt < fin).map(d => d.name),
  }

  // Hábitos: cumplimiento en los días programados del mes (hasta hoy si es el mes en curso)
  const primerDia = `${y}-${String(m).padStart(2, '0')}-01`
  const ultimoDia = addDays(dayKey(fin), -1)
  const hoy = dayKey(new Date())
  const habitos = habits.map(h => {
    let target = [1, 2, 3, 4, 5, 6, 7]
    try { target = (Array.isArray(h.targetDays) ? h.targetDays : JSON.parse(h.targetDays)).map(Number) } catch {}
    const hechos = new Set(h.logs.map(l => dayKey(l.date)))
    const desde = dayKey(h.createdAt) > primerDia ? dayKey(h.createdAt) : primerDia
    const hasta = hoy < ultimoDia ? hoy : ultimoDia
    let prog = 0, okD = 0
    for (let k = desde; k <= hasta; k = addDays(k, 1)) {
      if (!target.includes(isoDow(k))) continue
      prog++
      if (hechos.has(k)) okD++
    }
    return { name: h.name, prog, ok: okD, pct: prog ? Math.round((okD / prog) * 100) : null }
  }).filter(h => h.prog > 0)

  // Entrenos
  const sets = sessions.flatMap(s => s.setLogs)
  const volumen = sets.reduce((s, x) => s + x.weightKg * x.reps, 0)
  const porEj = {}
  for (const x of sets) {
    const e = (porEj[x.exerciseId] ||= { name: x.exercise?.name || 'Ejercicio', volumen: 0, series: 0, mejor: 0 })
    e.volumen += x.weightKg * x.reps
    e.series++
    e.mejor = Math.max(e.mejor, epley(x.weightKg, x.reps) || 0)
  }
  const ids = Object.keys(porEj)
  const previos = ids.length ? await prisma.setLog.findMany({
    where: { exerciseId: { in: ids }, isWarmup: false, session: { userId, startedAt: { lt: inicio } } },
    select: { exerciseId: true, weightKg: true, reps: true },
  }) : []
  const mejorAntes = {}
  for (const x of previos) mejorAntes[x.exerciseId] = Math.max(mejorAntes[x.exerciseId] || 0, epley(x.weightKg, x.reps) || 0)
  const records = ids
    .filter(id => porEj[id].mejor > 0 && mejorAntes[id] > 0 && porEj[id].mejor > mejorAntes[id])
    .map(id => ({ name: porEj[id].name, ahora: porEj[id].mejor, antes: mejorAntes[id] }))
    .sort((a, b) => b.ahora - b.antes - (a.ahora - a.antes))

  return {
    y, m, user,
    finanzas: { ingresos, gastos, balance: ingresos - gastos, ahorro: ingresos ? Math.round(((ingresos - gastos) / ingresos) * 100) : null, gastosPrev },
    categorias, topGastos,
    presupuestos: budgets.map(b => ({ name: b.category.name, amount: b.amount, spent: b.spent })).sort((a, b) => b.spent / b.amount - a.spent / a.amount),
    deudas, habitos,
    entrenos: {
      sesiones: sessions.length, series: sets.length, volumen,
      top: Object.values(porEj).sort((a, b) => b.volumen - a.volumen).slice(0, 5),
      records: records.slice(0, 5),
    },
  }
}

async function comentarioIA(d) {
  try {
    const f = d.finanzas
    const variacion = f.gastosPrev ? Math.round(((f.gastos - f.gastosPrev) / f.gastosPrev) * 100) : null
    const excedidos = d.presupuestos.filter(p => p.spent > p.amount).map(p => p.name)
    const habProm = d.habitos.length ? Math.round(d.habitos.reduce((s, h) => s + (h.pct || 0), 0) / d.habitos.length) : null
    const prompt = `/no_think
Escribe un comentario breve (3 a 4 frases, sin listas, sin emojis, sin títulos) sobre el mes de ${MESES[d.m - 1]} de ${d.y} de una persona en Colombia. Tono cercano y constructivo. Destaca un logro y una oportunidad de mejora concreta. No inventes datos.
Datos: ingresos ${fmt(f.ingresos)}; gastos ${fmt(f.gastos)}; balance ${fmt(f.balance)}; ahorro ${f.ahorro ?? 'sin datos'}%; variación de gastos frente al mes anterior: ${variacion === null ? 'sin datos' : variacion + '%'}.
Categorías principales: ${d.categorias.slice(0, 4).map(c => `${c.name} ${fmt(c.total)}`).join(', ') || 'ninguna'}.
Presupuestos excedidos: ${excedidos.join(', ') || 'ninguno'}.
Deuda pendiente: ${fmt(d.deudas.debo)}; abonos del mes: ${fmt(d.deudas.abonado)}.
Cumplimiento promedio de hábitos: ${habProm ?? 'sin datos'}%. Entrenos: ${d.entrenos.sesiones}; récords personales: ${d.entrenos.records.length}.
Responde solo con el texto del comentario.`
    let t = await callClaude(prompt, null, 'image/jpeg', 400)
    t = parseJSON(String(t).replace(/<think>[\s\S]*?<\/think>/g, ''))
    return limpiar(t).slice(0, 900)
  } catch (err) {
    logger.error('Reporte IA: ' + err.message)
    return null
  }
}

function construirPDF(d, comentario) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4', margin: 48, bufferPages: true,
      info: { Title: `Reporte de ${MESES[d.m - 1]} ${d.y}`, Author: 'Control de Gastos' },
    })
    const chunks = []
    doc.on('data', c => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const X = 48, W = doc.page.width - 96
    const asegurar = h => { if (doc.y + h > doc.page.height - 70) doc.addPage() }
    const titulo = t => {
      asegurar(70)
      doc.y += 14
      doc.fillColor(OSCURO).font('Helvetica-Bold').fontSize(13).text(t, X, doc.y)
      const yy = doc.y + 3
      doc.moveTo(X, yy).lineTo(X + W, yy).lineWidth(0.7).strokeColor('#E2E8F0').stroke()
      doc.y = yy + 8
    }
    const vacio = t => { doc.fillColor(GRIS).font('Helvetica').fontSize(9.5).text(t, X, doc.y); doc.y += 4 }
    const celda = (t, x, y, w, o = {}) => {
      doc.font(o.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(o.size || 9.5).fillColor(o.color || OSCURO)
        .text(limpiar(t), x, y, { width: w, align: o.align || 'left', lineBreak: false, ellipsis: true })
    }
    const kpis = items => {
      asegurar(70)
      const y0 = doc.y, gap = 10, bw = (W - gap * (items.length - 1)) / items.length
      items.forEach(([label, valor, color], i) => {
        const bx = X + i * (bw + gap)
        doc.roundedRect(bx, y0, bw, 52, 6).fill(CLARO)
        doc.fillColor(GRIS).font('Helvetica').fontSize(7.5).text(label.toUpperCase(), bx + 10, y0 + 10, { width: bw - 20, lineBreak: false })
        doc.fillColor(color || OSCURO).font('Helvetica-Bold').fontSize(13).text(valor, bx + 10, y0 + 25, { width: bw - 20, lineBreak: false, ellipsis: true })
      })
      doc.y = y0 + 62
    }
    const barra = (x, y, w, frac, color) => {
      doc.roundedRect(x, y, w, 8, 4).fill('#E2E8F0')
      if (frac > 0) doc.roundedRect(x, y, Math.max(6, w * Math.min(1, frac)), 8, 4).fill(color)
    }

    // ---------- Encabezado ----------
    doc.rect(0, 0, doc.page.width, 92).fill(VERDE)
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(21).text(`Reporte de ${cap(MESES[d.m - 1])} ${d.y}`, X, 30)
    const generado = new Date(Date.now() - OFFSET_MS).toISOString().slice(0, 10)
    doc.fillColor('#E1F5EE').font('Helvetica').fontSize(10).text(`${limpiar(d.user?.name || d.user?.email || '')} · generado el ${generado}`, X, 60)
    doc.y = 112

    // ---------- Resumen financiero ----------
    const f = d.finanzas
    titulo('Resumen financiero')
    kpis([
      ['Ingresos', fmt(f.ingresos), VERDE],
      ['Gastos', fmt(f.gastos), ROJO],
      ['Balance', fmt(f.balance), f.balance < 0 ? ROJO : VERDE],
      ['Ahorro', f.ahorro === null ? 'Sin datos' : `${f.ahorro}%`, OSCURO],
    ])
    if (f.gastosPrev) {
      const v = Math.round(((f.gastos - f.gastosPrev) / f.gastosPrev) * 100)
      vacio(`Gastaste ${Math.abs(v)}% ${v >= 0 ? 'más' : 'menos'} que el mes anterior (${fmt(f.gastosPrev)}).`)
    }

    // ---------- Gastos por categoría ----------
    titulo('Gastos por categoría')
    if (!d.categorias.length) vacio('Sin gastos registrados este mes.')
    const maxCat = d.categorias[0]?.total || 1
    for (const c of d.categorias.slice(0, 10)) {
      asegurar(20)
      const y0 = doc.y
      celda(c.name, X, y0, 130)
      barra(X + 135, y0 + 2, W - 135 - 150, c.total / maxCat, c.color || VERDE)
      celda(fmt(c.total), X + W - 140, y0, 90, { bold: true, align: 'right' })
      celda(`${Math.round((c.total / (f.gastos || 1)) * 100)}%`, X + W - 45, y0, 45, { color: GRIS, align: 'right' })
      doc.y = y0 + 18
    }

    // ---------- Presupuestos ----------
    titulo('Presupuestos')
    if (!d.presupuestos.length) vacio('No tenías presupuestos definidos este mes.')
    for (const p of d.presupuestos) {
      asegurar(20)
      const y0 = doc.y, frac = p.amount ? p.spent / p.amount : 0
      const color = frac > 1 ? ROJO : frac >= 0.8 ? AMBAR : VERDE
      celda(p.name, X, y0, 130)
      barra(X + 135, y0 + 2, W - 135 - 200, frac, color)
      celda(`${fmt(p.spent)} de ${fmt(p.amount)}`, X + W - 190, y0, 140, { align: 'right' })
      celda(`${Math.round(frac * 100)}%`, X + W - 45, y0, 45, { bold: true, color, align: 'right' })
      doc.y = y0 + 18
    }

    // ---------- Gastos más grandes ----------
    titulo('Gastos más grandes')
    if (!d.topGastos.length) vacio('Sin gastos registrados este mes.')
    for (const t of d.topGastos) {
      asegurar(18)
      const y0 = doc.y
      celda(dayKey(t.date).slice(5).split('-').reverse().join('/'), X, y0, 45, { color: GRIS })
      celda(t.description || 'Gasto', X + 50, y0, W - 50 - 230)
      celda(t.category?.name || '', X + W - 225, y0, 120, { color: GRIS })
      celda(fmt(t.amount), X + W - 100, y0, 100, { bold: true, align: 'right' })
      doc.y = y0 + 17
    }

    // ---------- Deudas ----------
    const dd = d.deudas
    if (dd.debo || dd.meDeben || dd.abonado || dd.cobrado) {
      titulo('Deudas y préstamos')
      kpis([
        ['Debes (saldo actual)', fmt(dd.debo), ROJO],
        ['Abonaste este mes', fmt(dd.abonado), VERDE],
        ['Te deben', fmt(dd.meDeben), OSCURO],
        ['Te pagaron', fmt(dd.cobrado), VERDE],
      ])
      if (dd.saldadas.length) vacio(`Deudas saldadas este mes: ${dd.saldadas.map(limpiar).join(', ')}.`)
    }

    // ---------- Hábitos ----------
    if (d.habitos.length) {
      titulo('Hábitos')
      for (const h of d.habitos) {
        asegurar(20)
        const y0 = doc.y, frac = (h.pct || 0) / 100
        const color = frac >= 0.8 ? VERDE : frac >= 0.5 ? AMBAR : ROJO
        celda(h.name, X, y0, 150)
        barra(X + 155, y0 + 2, W - 155 - 170, frac, color)
        celda(`${h.ok} de ${h.prog} días`, X + W - 160, y0, 110, { color: GRIS, align: 'right' })
        celda(`${h.pct}%`, X + W - 45, y0, 45, { bold: true, color, align: 'right' })
        doc.y = y0 + 18
      }
    }

    // ---------- Entrenos ----------
    const e = d.entrenos
    if (e.sesiones) {
      titulo('Entrenamiento')
      kpis([
        ['Sesiones', String(e.sesiones), OSCURO],
        ['Series', String(e.series), OSCURO],
        ['Volumen total', `${Math.round(e.volumen).toLocaleString('es-CO')} kg`, VERDE],
      ])
      if (e.top.length) {
        celda('Ejercicios con más volumen', X, doc.y, W, { bold: true, size: 10 })
        doc.y += 16
        for (const x of e.top) {
          asegurar(17)
          const y0 = doc.y
          celda(x.name, X, y0, W - 220)
          celda(`${x.series} series`, X + W - 210, y0, 90, { color: GRIS, align: 'right' })
          celda(`${Math.round(x.volumen).toLocaleString('es-CO')} kg`, X + W - 110, y0, 110, { bold: true, align: 'right' })
          doc.y = y0 + 16
        }
      }
      if (e.records.length) {
        doc.y += 6
        celda('Récords personales del mes (1RM estimado)', X, doc.y, W, { bold: true, size: 10 })
        doc.y += 16
        for (const r of e.records) {
          asegurar(17)
          const y0 = doc.y
          celda(r.name, X, y0, W - 220)
          celda(`antes ${r.antes} kg`, X + W - 210, y0, 100, { color: GRIS, align: 'right' })
          celda(`${r.ahora} kg`, X + W - 100, y0, 100, { bold: true, color: VERDE, align: 'right' })
          doc.y = y0 + 16
        }
      }
    }

    // ---------- Comentario de la IA ----------
    if (comentario) {
      titulo('Comentario del mes')
      doc.font('Helvetica').fontSize(10)
      const h = doc.heightOfString(comentario, { width: W - 28 })
      asegurar(h + 30)
      const y0 = doc.y
      doc.roundedRect(X, y0, W, h + 24, 8).fill('#F5F3FF')
      doc.fillColor(OSCURO).font('Helvetica').fontSize(10).text(comentario, X + 14, y0 + 12, { width: W - 28 })
      doc.y = y0 + h + 30
      doc.fillColor(GRIS).fontSize(7.5).text('Comentario generado automáticamente; no es asesoría financiera profesional.', X, doc.y)
    }

    // ---------- Pie de página ----------
    const r = doc.bufferedPageRange()
    for (let i = r.start; i < r.start + r.count; i++) {
      doc.switchToPage(i)
      doc.page.margins.bottom = 0 // evita que el pie cree una página nueva
      doc.fillColor(GRIS).font('Helvetica').fontSize(8)
        .text(`Control de Gastos · gastos.sebscode.dev · Página ${i + 1} de ${r.count}`, X, doc.page.height - 34, { width: W, align: 'center' })
    }
    doc.end()
  })
}

async function monthlyReport(userId, y, m, { ia = true } = {}) {
  const d = await datosMes(userId, y, m)
  const comentario = ia ? await comentarioIA(d) : null
  return construirPDF(d, comentario)
}

function sendTelegramDocument(chatId, buffer, filename, caption) {
  return new Promise((resolve, reject) => {
    const token = process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN
    if (!token) return reject(Object.assign(new Error('Falta TELEGRAM_TOKEN en el .env del backend'), { status: 500 }))
    const b = '----gastos' + Date.now()
    const partes = []
    const campo = (n, v) => partes.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="${n}"\r\n\r\n${v}\r\n`))
    campo('chat_id', chatId)
    if (caption) campo('caption', caption)
    partes.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="document"; filename="${filename}"\r\nContent-Type: application/pdf\r\n\r\n`))
    partes.push(buffer)
    partes.push(Buffer.from(`\r\n--${b}--\r\n`))
    const body = Buffer.concat(partes)
    const req = https.request({
      hostname: 'api.telegram.org', path: `/bot${token}/sendDocument`, method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${b}`, 'Content-Length': body.length },
    }, res => {
      let data = ''
      res.on('data', c => (data += c))
      res.on('end', () => (res.statusCode < 300 ? resolve() : reject(new Error(`Telegram ${res.statusCode}: ${data.slice(0, 200)}`))))
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

const nombreArchivo = (y, m) => `reporte-${y}-${String(m).padStart(2, '0')}.pdf`

async function sendReportTelegram(userId, chatId, y, m) {
  const pdf = await monthlyReport(userId, y, m)
  await sendTelegramDocument(chatId, pdf, nombreArchivo(y, m), `📄 Tu reporte de ${MESES[m - 1]} ${y}`)
}

/** Día 1 de cada mes: envía por Telegram el reporte del mes anterior */
async function sendMonthlyReports() {
  const { y, m } = mesActual()
  const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1
  const users = await prisma.user.findMany({ where: { telegramChatId: { not: null } }, select: { id: true, telegramChatId: true } })
  for (const u of users) {
    try { await sendReportTelegram(u.id, u.telegramChatId, py, pm) } catch (err) { logger.error('Reporte mensual Telegram: ' + err.message) }
    await new Promise(r => setTimeout(r, 5000))
  }
  logger.info(`Reportes de ${MESES[pm - 1]} enviados a ${users.length} usuario(s)`)
}

module.exports = { monthlyReport, sendReportTelegram, sendMonthlyReports, mesActual, nombreArchivo }
