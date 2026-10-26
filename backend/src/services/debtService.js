// backend/src/services/debtService.js
// Deudas y préstamos: abonos vinculados a movimientos, simulación de pago,
// consejos con IA (Groq) y resumen semanal por Telegram.
const https = require('https')
const prisma = require('../config/prisma')
const logger = require('../config/logger')
const budgetService = require('./budgetService')
const alertService = require('./alertService')
const { callClaude, parseJSON } = require('./claudeService')

const CATEGORIAS = {
  I_OWE: { name: 'Deudas', icon: 'credit-card', color: '#B42318', type: 'EXPENSE' },
  OWED_TO_ME: { name: 'Préstamos', icon: 'wallet', color: '#1D4ED8', type: 'INCOME' },
}
const TIPO_LABEL = {
  CREDIT_CARD: 'Tarjeta de crédito', LOAN: 'Crédito bancario', PERSONAL: 'Préstamo personal',
  MORTGAGE: 'Crédito hipotecario', VEHICLE: 'Crédito de vehículo', OTHER: 'Otra deuda',
}

const fmt = n => `$${Math.round(n || 0).toLocaleString('es-CO')}`
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Tasa mensual efectiva (decimal) a partir de EA o mensual */
function monthlyRate(d) {
  const r = (d.interestRate || 0) / 100
  if (r <= 0) return 0
  return d.rateType === 'MONTHLY' ? r : Math.pow(1 + r, 1 / 12) - 1
}
/** Tasa EA equivalente en porcentaje */
function eaDe(d) {
  const r = (d.interestRate || 0) / 100
  if (r <= 0) return 0
  return d.rateType === 'MONTHLY' ? (Math.pow(1 + r, 12) - 1) * 100 : d.interestRate
}
/** Cuota mínima; si no está registrada se asume el 3 % del saldo */
const minPaymentOf = d => (d.minPayment && d.minPayment > 0 ? d.minPayment : Math.max(d.balance * 0.03, 0))

function summary(debts) {
  const act = debts.filter(d => !d.isPaid)
  const debo = act.filter(d => d.direction === 'I_OWE')
  const meDeben = act.filter(d => d.direction === 'OWED_TO_ME')
  return {
    iOwe: Math.round(debo.reduce((s, d) => s + d.balance, 0)),
    owedToMe: Math.round(meDeben.reduce((s, d) => s + d.balance, 0)),
    monthlyMin: Math.round(debo.reduce((s, d) => s + minPaymentOf(d), 0)),
    monthlyInterest: Math.round(debo.reduce((s, d) => s + d.balance * monthlyRate(d), 0)),
  }
}

async function categoriaPara(userId, direction) {
  const c = CATEGORIAS[direction]
  const found = await prisma.category.findFirst({
    where: { name: c.name, OR: [{ userId }, { userId: null }] }, select: { id: true },
  })
  if (found) return found.id
  const created = await prisma.category.create({ data: { name: c.name, icon: c.icon, color: c.color, userId } })
  return created.id
}

async function refrescarPresupuesto(userId, categoryId, date) {
  if (!categoryId) return
  try {
    await budgetService.updateSpent(userId, categoryId, date)
    await alertService.checkBudgetAlerts(userId, categoryId, date)
  } catch (err) { logger.error('[debts] presupuesto: ' + err.message) }
}

/** Registra un abono: crea el gasto/ingreso vinculado y baja el saldo */
async function addPayment({ userId, debt, amount, date, notes }) {
  const monto = Math.round(Number(amount))
  if (!(monto > 0)) throw Object.assign(new Error('El monto del abono no es válido'), { status: 400 })
  const c = CATEGORIAS[debt.direction]
  const fecha = date ? new Date(date) : new Date()
  const categoryId = await categoriaPara(userId, debt.direction)

  const tx = await prisma.transaction.create({
    data: {
      amount: monto, type: c.type, source: 'MANUAL', userId, categoryId, date: fecha,
      description: debt.direction === 'I_OWE' ? `💳 Abono: ${debt.name}` : `🤝 Abono recibido: ${debt.name}`,
      notes: 'Creado automáticamente desde Deudas',
    },
  })
  const payment = await prisma.debtPayment.create({
    data: { debtId: debt.id, userId, amount: monto, date: fecha, notes: notes || null, transactionId: tx.id },
  })
  const saldo = Math.max(0, debt.balance - monto)
  await prisma.debt.update({
    where: { id: debt.id },
    data: { balance: saldo, isPaid: saldo <= 0, paidAt: saldo <= 0 ? new Date() : null },
  })
  if (c.type === 'EXPENSE') await refrescarPresupuesto(userId, categoryId, fecha)
  return payment
}

/** Elimina un abono, su movimiento vinculado, y devuelve el monto al saldo */
async function removePayment({ userId, paymentId }) {
  const p = await prisma.debtPayment.findFirst({ where: { id: paymentId, userId }, include: { debt: true } })
  if (!p) return false
  const tx = p.transactionId
    ? await prisma.transaction.findFirst({ where: { id: p.transactionId, userId }, select: { categoryId: true, date: true, type: true } })
    : null
  await prisma.debtPayment.delete({ where: { id: p.id } })
  if (p.transactionId) await prisma.transaction.deleteMany({ where: { id: p.transactionId, userId } })
  await prisma.debt.update({
    where: { id: p.debtId }, data: { balance: p.debt.balance + p.amount, isPaid: false, paidAt: null },
  })
  if (tx && tx.type === 'EXPENSE') await refrescarPresupuesto(userId, tx.categoryId, tx.date)
  return true
}

/** Elimina una deuda con sus abonos y los movimientos vinculados */
async function removeDebt({ userId, debtId }) {
  const debt = await prisma.debt.findFirst({
    where: { id: debtId, userId }, include: { payments: { select: { transactionId: true } } },
  })
  if (!debt) return false
  const ids = debt.payments.map(p => p.transactionId).filter(Boolean)
  const txs = ids.length
    ? await prisma.transaction.findMany({ where: { id: { in: ids }, userId }, select: { categoryId: true, date: true, type: true } })
    : []
  await prisma.debt.delete({ where: { id: debt.id } })
  if (ids.length) await prisma.transaction.deleteMany({ where: { id: { in: ids }, userId } })
  const vistos = new Set()
  for (const t of txs) {
    if (t.type !== 'EXPENSE') continue
    const k = `${t.categoryId}|${t.date.getUTCFullYear()}-${t.date.getUTCMonth()}`
    if (vistos.has(k)) continue
    vistos.add(k)
    await refrescarPresupuesto(userId, t.categoryId, t.date)
  }
  return true
}

/**
 * Simula el pago mes a mes. Todas las cuotas mínimas + el extra forman un presupuesto fijo:
 * cuando una deuda se salda, su cuota se suma al ataque de la siguiente.
 * avalanche: primero la tasa más alta. snowball: primero el saldo más pequeño.
 */
function simulate(debts, extra = 0, strategy = 'avalanche') {
  const ds = debts
    .filter(d => d.direction === 'I_OWE' && !d.isPaid && d.balance > 0)
    .map(d => ({ id: d.id, name: d.name, balance: d.balance, rate: monthlyRate(d), min: minPaymentOf(d), month: null }))
  if (!ds.length) return { months: 0, totalInterest: 0, totalPaid: 0, monthlyBudget: 0, order: [], feasible: true, payoff: [] }

  const presupuesto = ds.reduce((s, d) => s + d.min, 0) + Math.max(0, extra)
  const orden = [...ds].sort(strategy === 'avalanche'
    ? (a, b) => b.rate - a.rate || a.balance - b.balance
    : (a, b) => a.balance - b.balance || b.rate - a.rate)

  let mes = 0, intereses = 0, pagado = 0
  while (ds.some(d => d.balance > 0.5) && mes < 600) {
    mes++
    for (const d of ds) if (d.balance > 0) { const i = d.balance * d.rate; d.balance += i; intereses += i }
    let disponible = presupuesto
    for (const d of ds) {
      if (d.balance <= 0) continue
      const p = Math.min(d.min, d.balance, disponible)
      d.balance -= p; disponible -= p; pagado += p
    }
    for (const d of orden) {
      if (d.balance <= 0 || disponible <= 0) continue
      const p = Math.min(d.balance, disponible)
      d.balance -= p; disponible -= p; pagado += p
    }
    for (const d of ds) if (d.balance <= 0.5 && d.month === null) { d.balance = 0; d.month = mes }
  }
  const feasible = !ds.some(d => d.balance > 0.5)
  return {
    months: feasible ? mes : null,
    totalInterest: Math.round(intereses),
    totalPaid: Math.round(pagado),
    monthlyBudget: Math.round(presupuesto),
    order: orden.map(d => ({ id: d.id, name: d.name })),
    feasible,
    payoff: ds.map(d => ({ id: d.id, name: d.name, month: d.month })),
  }
}

/** Promedios de ingresos y gastos de los últimos 90 días (o desde el primer movimiento) */
async function financialSnapshot(userId) {
  const hace90 = new Date(Date.now() - 90 * 864e5)
  const txs = await prisma.transaction.findMany({
    where: { userId, date: { gte: hace90 }, type: { in: ['INCOME', 'EXPENSE'] } },
    select: { amount: true, type: true, date: true, category: { select: { name: true } } },
  })
  const primera = txs.reduce((m, t) => (t.date < m ? t.date : m), new Date())
  const meses = Math.min(3, Math.max(1, (Date.now() - primera.getTime()) / (30 * 864e5)))
  let ingresos = 0, gastos = 0
  const porCat = {}
  for (const t of txs) {
    if (t.type === 'INCOME') ingresos += t.amount
    else {
      gastos += t.amount
      const n = t.category?.name || 'Sin categoría'
      porCat[n] = (porCat[n] || 0) + t.amount
    }
  }
  return {
    months: Math.round(meses * 10) / 10,
    avgIncome: Math.round(ingresos / meses),
    avgExpenses: Math.round(gastos / meses),
    topCategories: Object.entries(porCat)
      .map(([name, total]) => ({ name, monthly: Math.round(total / meses) }))
      .sort((a, b) => b.monthly - a.monthly).slice(0, 8),
  }
}

function parseAI(raw) {
  let t = String(raw || '').replace(/<think>[\s\S]*?<\/think>/g, '')
  t = parseJSON(t)
  const i = t.indexOf('{'), j = t.lastIndexOf('}')
  try { return JSON.parse(t.slice(i, j + 1)) } catch { return { resumen: t.trim().slice(0, 1500) } }
}

/** Genera el análisis con IA y lo guarda. A Groq solo se envían montos y etiquetas genéricas. */
async function generateAdvice(userId) {
  const [debts, snap] = await Promise.all([
    prisma.debt.findMany({ where: { userId, isPaid: false } }),
    financialSnapshot(userId),
  ])
  const debo = debts.filter(d => d.direction === 'I_OWE')
  const meDeben = debts.filter(d => d.direction === 'OWED_TO_ME')
  const margen = Math.max(0, snap.avgIncome - snap.avgExpenses)
  const extra = Math.round((margen * 0.5) / 1000) * 1000

  const avalancha = simulate(debo, extra, 'avalanche')
  const bola = simulate(debo, extra, 'snowball')
  const minimos = simulate(debo, 0, 'avalanche')

  // Anonimizar: "Tarjeta de crédito 1", "Préstamo personal 2"...
  const cont = {}
  const etiqueta = {}
  for (const d of debo) {
    const t = TIPO_LABEL[d.type] || 'Deuda'
    cont[t] = (cont[t] || 0) + 1
    etiqueta[d.id] = `${t} ${cont[t]}`
  }
  const deudas = debo.map(d => ({
    deuda: etiqueta[d.id], saldo: Math.round(d.balance),
    tasaEA: Math.round(eaDe(d) * 10) / 10, cuotaMinima: Math.round(minPaymentOf(d)),
    interesMensual: Math.round(d.balance * monthlyRate(d)),
  }))
  const orden = s => s.order.map(o => etiqueta[o.id]).join(' → ') || '—'
  const tiempo = s => (s.months === null ? 'nunca (la cuota no cubre los intereses)' : `${s.months} meses`)

  const prompt = `/no_think
Eres un asesor de finanzas personales para una persona en Colombia (moneda: pesos colombianos, COP).
Analiza SOLO con los datos dados. No inventes cifras. Los cálculos de pago ya están hechos: úsalos tal cual.

INGRESOS Y GASTOS (promedio mensual, últimos ${snap.months} meses):
- Ingresos: ${fmt(snap.avgIncome)}
- Gastos: ${fmt(snap.avgExpenses)}
- Margen mensual: ${fmt(snap.avgIncome - snap.avgExpenses)}
Gastos por categoría (la categoría "Deudas" son abonos a deudas):
${snap.topCategories.map(c => `- ${c.name}: ${fmt(c.monthly)}`).join('\n') || '- Sin datos'}

DEUDAS QUE TIENE:
${deudas.length ? JSON.stringify(deudas) : 'Ninguna'}
DINERO QUE LE DEBEN: ${fmt(meDeben.reduce((s, d) => s + d.balance, 0))} en ${meDeben.length} préstamo(s)

SIMULACIÓN DE PAGO:
- Solo cuotas mínimas: ${tiempo(minimos)}, intereses totales ${fmt(minimos.totalInterest)}
- Avalancha (mínimos + ${fmt(extra)} extra al mes): ${tiempo(avalancha)}, intereses ${fmt(avalancha.totalInterest)}, orden: ${orden(avalancha)}
- Bola de nieve (mínimos + ${fmt(extra)} extra al mes): ${tiempo(bola)}, intereses ${fmt(bola.totalInterest)}, orden: ${orden(bola)}

Responde SOLO con JSON válido, sin texto adicional, con esta forma:
{"resumen":"2-3 frases sobre su situación","estrategia":"avalancha o bola de nieve","porQue":"1-2 frases","prioridad":"qué deuda atacar primero (usa su etiqueta) y por qué","recortes":[{"categoria":"nombre exacto de una categoría listada","ahorroMensual":número,"como":"acción concreta"}],"consejos":["3 a 5 consejos concretos y accionables"],"alertas":["riesgos importantes; lista vacía si no hay"]}

Reglas: español de Colombia, tono cercano y directo. Recortes solo de categorías listadas, con ahorro realista (máximo 30 % de esa categoría). No recomiendes bancos ni productos específicos. Si sugieres refinanciar o comprar cartera, indica que debe comparar opciones con su banco. Si no tiene deudas, enfócate en ahorro y fondo de emergencia (3 a 6 meses de gastos).`

  const raw = await callClaude(prompt, null, 'image/jpeg', 1500)
  const ai = parseAI(raw)
  return prisma.financialAdvice.create({
    data: { userId, content: { ai, plan: { extra, avalancha, bola, minimos }, snapshot: snap } },
  })
}

const sendTelegram = (chatId, text) => new Promise((resolve, reject) => {
  const token = process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) return reject(Object.assign(new Error('Falta TELEGRAM_TOKEN en el .env del backend'), { status: 500 }))
  const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })
  const req = https.request({
    hostname: 'api.telegram.org', path: `/bot${token}/sendMessage`, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, res => {
    let data = ''
    res.on('data', c => (data += c))
    res.on('end', () => (res.statusCode < 300 ? resolve() : reject(new Error(`Telegram ${res.statusCode}: ${data.slice(0, 200)}`))))
  })
  req.on('error', reject)
  req.write(body)
  req.end()
})

/** Resumen semanal: gastos de la semana, deudas, próximos pagos y consejos de la IA */
async function weeklySummary(userId, chatId) {
  const hace7 = new Date(Date.now() - 7 * 864e5)
  const [gastos, debts] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, type: 'EXPENSE', date: { gte: hace7 } },
      select: { amount: true, category: { select: { name: true } } },
    }),
    prisma.debt.findMany({ where: { userId, isPaid: false } }),
  ])
  const total = gastos.reduce((s, t) => s + t.amount, 0)
  const porCat = {}
  for (const t of gastos) { const n = t.category?.name || 'Sin categoría'; porCat[n] = (porCat[n] || 0) + t.amount }
  const top = Object.entries(porCat).sort((a, b) => b[1] - a[1])[0]
  const s = summary(debts)

  const hoyDia = Number(new Date(Date.now() - 5 * 3600e3).toISOString().slice(8, 10))
  const proximos = debts
    .filter(d => d.direction === 'I_OWE' && d.dueDay)
    .map(d => ({ d, dias: (d.dueDay - hoyDia + 31) % 31 }))
    .filter(x => x.dias <= 7)
    .sort((a, b) => a.dias - b.dias)

  let ai = null
  try { ai = (await generateAdvice(userId)).content.ai } catch (err) { logger.error('[debts] IA semanal: ' + err.message) }

  const lineas = [
    '📊 <b>Tu resumen semanal</b>',
    '',
    `💸 Gastos de los últimos 7 días: <b>${fmt(total)}</b>${top ? ` (más en ${esc(top[0])}: ${fmt(top[1])})` : ''}`,
  ]
  if (s.iOwe) lineas.push(`💳 Deuda total: <b>${fmt(s.iOwe)}</b> · intereses aprox. ${fmt(s.monthlyInterest)}/mes`)
  if (s.owedToMe) lineas.push(`🤝 Te deben: <b>${fmt(s.owedToMe)}</b>`)
  if (proximos.length) {
    lineas.push('', '📅 <b>Pagos próximos</b>')
    for (const { d, dias } of proximos) lineas.push(`• ${esc(d.name)}: día ${d.dueDay}${dias === 0 ? ' (hoy)' : ` (en ${dias} día${dias > 1 ? 's' : ''})`}`)
  }
  if (ai?.resumen) lineas.push('', `🤖 ${esc(ai.resumen)}`)
  if (ai?.consejos?.length) {
    lineas.push('', '💡 <b>Consejos</b>')
    for (const c of ai.consejos.slice(0, 3)) lineas.push(`• ${esc(c)}`)
  }
  lineas.push('', '<i>Sugerencias automáticas, no asesoría financiera profesional.</i>')
  await sendTelegram(chatId, lineas.join('\n'))
}

async function sendWeeklySummaries() {
  const users = await prisma.user.findMany({
    where: { telegramChatId: { not: null } }, select: { id: true, telegramChatId: true },
  })
  for (const u of users) {
    try { await weeklySummary(u.id, u.telegramChatId) } catch (err) { logger.error('[debts] resumen semanal: ' + err.message) }
    await new Promise(r => setTimeout(r, 5000))
  }
  logger.info(`[debts] resumen semanal enviado a ${users.length} usuario(s)`)
}

module.exports = {
  monthlyRate, summary, simulate, addPayment, removePayment, removeDebt,
  generateAdvice, weeklySummary, sendWeeklySummaries,
}
