// backend/src/services/forecastService.js
// Proyección de gastos del mes por categoría, análisis con IA y alerta anticipada.
const prisma = require('../config/prisma')
const logger = require('../config/logger')
const { callClaude, parseJSON } = require('./claudeService')

const OFFSET_MS = 5 * 3600e3 // Colombia: UTC-5
const fmt = n => `$${Math.round(n || 0).toLocaleString('es-CO')}`

function contextoMes() {
  const b = new Date(Date.now() - OFFSET_MS)
  const y = b.getUTCFullYear(), m = b.getUTCMonth()
  const dia = b.getUTCDate()
  const diasMes = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  return {
    y, m, dia, diasMes,
    hoy: b.toISOString().slice(0, 10),
    inicio: new Date(Date.UTC(y, m, 1, 5)),        // 00:00 Colombia del día 1
    fin: new Date(Date.UTC(y, m + 1, 1, 5)),
    inicioHist: new Date(Date.UTC(y, m - 3, 1, 5)), // 3 meses atrás
  }
}

async function forecast(userId) {
  const c = contextoMes()
  const restantes = c.diasMes - c.dia

  const [mes, hist, budgets, primera, ingresosMes, ingresosHist] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, type: 'EXPENSE', date: { gte: c.inicio, lt: c.fin } },
      select: { amount: true, categoryId: true, category: { select: { name: true, color: true } } },
    }),
    prisma.transaction.groupBy({
      by: ['categoryId'], where: { userId, type: 'EXPENSE', date: { gte: c.inicioHist, lt: c.inicio } }, _sum: { amount: true },
    }),
    prisma.budget.findMany({
      where: { userId, month: c.m + 1, year: c.y }, include: { category: { select: { name: true, color: true } } },
    }),
    prisma.transaction.findFirst({ where: { userId }, orderBy: { date: 'asc' }, select: { date: true } }),
    prisma.transaction.aggregate({ where: { userId, type: 'INCOME', date: { gte: c.inicio, lt: c.fin } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { userId, type: 'INCOME', date: { gte: c.inicioHist, lt: c.inicio } }, _sum: { amount: true } }),
  ])

  // Meses completos de historial disponibles (0 a 3)
  const desde = primera ? Math.max(primera.date.getTime(), c.inicioHist.getTime()) : c.inicio.getTime()
  const mesesHist = Math.max(0, Math.min(3, Math.round((c.inicio.getTime() - desde) / (30.4 * 864e5))))

  const cats = {}
  const cat = (id, info) => (cats[id || 'sin'] ||= {
    categoryId: id || null, name: info?.name || 'Sin categoría', color: info?.color || '#64748b',
    spent: 0, maxTx: 0, count: 0, hist: 0, budget: null,
  })
  for (const t of mes) {
    const k = cat(t.categoryId, t.category)
    k.spent += t.amount; k.count++; k.maxTx = Math.max(k.maxTx, t.amount)
  }
  for (const h of hist) if (h.categoryId) cat(h.categoryId, null).hist = h._sum.amount || 0
  for (const b of budgets) { const k = cat(b.categoryId, b.category); k.budget = b.amount; k.name = b.category.name; k.color = b.category.color }

  // Nombres de categorías que solo aparecen en el historial
  const sinNombre = Object.values(cats).filter(k => k.categoryId && k.name === 'Sin categoría')
  if (sinNombre.length) {
    const info = await prisma.category.findMany({ where: { id: { in: sinNombre.map(k => k.categoryId) } }, select: { id: true, name: true, color: true } })
    for (const i of info) { const k = cats[i.id]; k.name = i.name; k.color = i.color }
  }

  // Peso del ritmo actual: crece con los días del mes (con historial); sin historial solo hay ritmo actual
  const w = mesesHist ? Math.min(1, c.dia / 20) : 1
  const categorias = Object.values(cats).map(k => {
    // Un gasto único que es más de la mitad de lo gastado (ej. arriendo) no se proyecta día a día
    const base = k.count > 0 && k.maxTx > 0.5 * k.spent && c.dia < 25 ? k.spent - k.maxTx : k.spent
    const ritmo = base / c.dia
    const histDiario = mesesHist ? k.hist / mesesHist / 30.4 : 0
    const diario = w * ritmo + (1 - w) * histDiario
    const projected = Math.round(k.spent + diario * restantes)
    let status = 'none', overBy = 0, dailyAllowance = null
    if (k.budget) {
      status = projected > k.budget ? 'over' : projected > 0.9 * k.budget ? 'risk' : 'ok'
      overBy = Math.max(0, projected - k.budget)
      dailyAllowance = Math.max(0, Math.round((k.budget - k.spent) / (restantes + 1)))
    }
    return {
      categoryId: k.categoryId, name: k.name, color: k.color,
      spent: Math.round(k.spent), projected, budget: k.budget,
      histMonthly: mesesHist ? Math.round(k.hist / mesesHist) : null,
      status, overBy, dailyAllowance,
    }
  }).filter(k => k.spent > 0 || k.budget || k.projected > 0)

  const orden = { over: 0, risk: 1, ok: 2, none: 3 }
  categorias.sort((a, b) => orden[a.status] - orden[b.status] || b.projected - a.projected)

  const confidence = c.dia >= 20 || (mesesHist && c.dia >= 10) ? 'alta' : c.dia >= 10 || mesesHist ? 'media' : 'baja'
  return {
    day: c.dia, daysInMonth: c.diasMes, monthsOfHistory: mesesHist, confidence,
    totals: {
      spent: Math.round(categorias.reduce((s, k) => s + k.spent, 0)),
      projected: Math.round(categorias.reduce((s, k) => s + k.projected, 0)),
      incomeMonth: Math.round(ingresosMes._sum.amount || 0),
      avgIncome: mesesHist ? Math.round((ingresosHist._sum.amount || 0) / mesesHist) : 0,
    },
    categories: categorias,
  }
}

// ---------- Análisis con IA (en caché por usuario y día) ----------
const cache = new Map()

function parseAI(raw) {
  let t = String(raw || '').replace(/<think>[\s\S]*?<\/think>/g, '')
  t = parseJSON(t)
  const i = t.indexOf('{'), j = t.lastIndexOf('}')
  try { return JSON.parse(t.slice(i, j + 1)) } catch { return { resumen: t.trim().slice(0, 1200) } }
}

async function insights(userId, forzar = false) {
  const c = contextoMes()
  const key = `${userId}|${c.hoy}`
  if (!forzar && cache.has(key)) return cache.get(key)

  const f = await forecast(userId)
  const lineas = f.categories.slice(0, 10).map(k => {
    const pres = k.budget ? ` / presupuesto ${fmt(k.budget)}` : ' / sin presupuesto'
    const estado = k.status === 'over' ? ` (se pasaría por ${fmt(k.overBy)})` : k.status === 'risk' ? ' (en riesgo)' : ''
    return `- ${k.name}: gastado ${fmt(k.spent)} / proyección ${fmt(k.projected)}${pres}${estado}`
  }).join('\n')
  const ingreso = Math.max(f.totals.incomeMonth, f.totals.avgIncome)

  const prompt = `/no_think
Eres un asesor de finanzas personales para una persona en Colombia (moneda COP).
Hoy es el día ${f.day} de ${f.daysInMonth} del mes. Confianza de la proyección: ${f.confidence} (${f.monthsOfHistory} meses de historial).
La proyección ya está calculada con su ritmo de este mes y su promedio histórico: úsala tal cual, no la recalcules.

- Gastado hasta hoy: ${fmt(f.totals.spent)}
- Proyección al cierre del mes: ${fmt(f.totals.projected)}
- Ingresos de referencia: ${ingreso ? fmt(ingreso) : 'sin datos'}

Por categoría:
${lineas || '- Sin gastos registrados'}

Responde SOLO con JSON válido, sin texto adicional:
{"resumen":"2 frases sobre cómo va el mes","alertas":[{"categoria":"nombre exacto","mensaje":"1 frase concreta"}],"recomendaciones":["2 a 4 acciones concretas para lo que queda del mes"]}

Reglas: español de Colombia, directo y amable. Solo categorías de la lista. No inventes cifras. Si la confianza es baja, menciónalo en el resumen. alertas puede ser una lista vacía.`

  const ai = parseAI(await callClaude(prompt, null, 'image/jpeg', 900))
  const out = { ...ai, generatedAt: new Date().toISOString() }
  cache.set(key, out)
  if (cache.size > 500) cache.clear()
  return out
}

// ---------- Alerta anticipada por push (cron diario 8 p. m.) ----------
const avisadas = new Set()
async function checkForecastAlerts() {
  const c = contextoMes()
  if (c.dia < 5) return // muy pocos días para proyectar con confianza
  const push = require('./pushService')
  const users = await prisma.budget.findMany({ where: { month: c.m + 1, year: c.y }, distinct: ['userId'], select: { userId: true } })
  for (const { userId } of users) {
    try {
      const f = await forecast(userId)
      for (const k of f.categories) {
        if (k.status !== 'over' || k.spent >= k.budget) continue // si ya se pasó, alertService ya avisó
        const key = `${userId}|${k.categoryId}|${c.y}-${c.m}`
        if (avisadas.has(key)) continue
        avisadas.add(key)
        await push.notify(userId, 'budget', {
          title: `📈 Vas camino a pasarte en ${k.name}`,
          body: `Proyección ${fmt(k.projected)} vs presupuesto ${fmt(k.budget)}. Para no pasarte: ${fmt(k.dailyAllowance)} al día.`,
          url: '/', tag: `forecast-${k.categoryId}`,
        })
      }
    } catch (err) { logger.error('Proyección push: ' + err.message) }
  }
}

module.exports = { forecast, insights, checkForecastAlerts }
