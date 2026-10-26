// backend/src/services/importService.js
// Importación de extractos: PDF (Bancolombia exacto; otros con IA), CSV y Excel.
const { execFile } = require('child_process')
const fs = require('fs/promises')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const prisma = require('../config/prisma')
const logger = require('../config/logger')
const budgetService = require('./budgetService')
const alertService = require('./alertService')
const { callClaude, parseJSON } = require('./claudeService')

const OFFSET_MS = 5 * 3600e3
const dayKey = d => new Date(new Date(d).getTime() - OFFSET_MS).toISOString().slice(0, 10)
const sleep = ms => new Promise(r => setTimeout(r, ms))
const httpError = (msg, status = 400, extra = {}) => Object.assign(new Error(msg), { status, ...extra })

// ---------- Utilidades ----------
function parseMonto(s) {
  if (s === null || s === undefined || s === '') return null
  if (typeof s === 'number') return s
  let t = String(s).trim().replace(/[$\sCOP]/gi, '')
  const neg = /^-|^\(.*\)$|-$/.test(t)
  t = t.replace(/[()+\-]/g, '')
  if (!/\d/.test(t)) return null
  const m = t.match(/[.,](\d{1,2})$/)
  let n
  if (m) {
    const ent = t.slice(0, -m[0].length).replace(/[.,]/g, '')
    n = parseFloat(`${ent || '0'}.${m[1]}`)
  } else {
    n = parseFloat(t.replace(/[.,]/g, ''))
  }
  return isNaN(n) ? null : neg ? -n : n
}

function parseFecha(v) {
  if (v instanceof Date && !isNaN(v)) return dayKey(new Date(v.getTime() + OFFSET_MS))
  const s = String(v || '').trim()
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3]
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  return null
}

const limpiarDesc = s => String(s || '').replace(/[•*]+/g, ' ').replace(/\s+/g, ' ').trim()

function detectarBanco(texto) {
  const t = texto.toUpperCase()
  if (t.includes('AMERICAN EXPRESS') || t.includes('AMEX')) return 'American Express'
  if (t.includes('BANCOLOMBIA')) return 'Bancolombia'
  if (t.includes('NEQUI')) return 'Nequi'
  if (t.includes('DAVIPLATA')) return 'Daviplata'
  if (t.includes('DAVIVIENDA')) return 'Davivienda'
  if (t.includes('BBVA')) return 'BBVA'
  if (/\bNU\b|NU COLOMBIA|NUBANK/.test(t)) return 'Nu'
  return 'Banco'
}

// ---------- PDF ----------
const execFileP = (cmd, args) => new Promise((resolve, reject) =>
  execFile(cmd, args, { maxBuffer: 20 * 1024 * 1024, timeout: 30000 }, (err, stdout, stderr) =>
    err ? reject(Object.assign(err, { stderr })) : resolve(stdout)))

async function pdfATexto(buffer, password) {
  const tmp = path.join(os.tmpdir(), `extracto-${crypto.randomUUID()}.pdf`)
  await fs.writeFile(tmp, buffer, { mode: 0o600 })
  try {
    const args = ['-layout', '-enc', 'UTF-8']
    if (password) args.push('-upw', String(password))
    args.push(tmp, '-')
    return await execFileP('pdftotext', args)
  } catch (err) {
    if (err.code === 'ENOENT') throw httpError('Falta pdftotext en el servidor (instala poppler-utils)', 500)
    if (/password/i.test(err.stderr || '')) {
      throw httpError(password ? 'La contraseña del PDF es incorrecta' : 'Este PDF tiene contraseña. Escríbela para continuar.', 400, { needsPassword: true })
    }
    throw err
  } finally {
    fs.unlink(tmp).catch(() => {})
  }
}

/** Lector exacto del estado de cuenta de ahorros/corriente de Bancolombia */
function parseBancolombia(texto) {
  if (!/ESTADO DE CUENTA/i.test(texto) || !/FECHA\s+DESCRIPCI[ÓO]N/i.test(texto)) return null
  const per = texto.match(/DESDE:\s*(\d{4})\/(\d{2})\/(\d{2})\s+HASTA:\s*(\d{4})\/(\d{2})\/(\d{2})/)
  if (!per) return null
  const [y1, m1, d1, y2, m2, d2] = per.slice(1).map(Number)
  const re = /^\s*(\d{1,2})\/(\d{1,2})\s+(.+?)\s{2,}(-?[\d,]*\.\d{2})\s+(-?[\d,]*\.\d{2})\s*$/
  const rows = []
  for (const linea of texto.split('\n')) {
    const m = linea.match(re)
    if (!m) continue
    let dia = Number(m[1]), mes = Number(m[2])
    if (mes !== m1 && mes !== m2 && (dia === m1 || dia === m2)) [dia, mes] = [mes, dia]
    const y = mes === m2 ? y2 : y1
    const valor = parseMonto(m[4])
    if (valor === null || valor === 0) continue
    rows.push({
      date: `${y}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
      description: limpiarDesc(m[3].split(/\s{2,}/)[0]),
      amount: Math.abs(valor),
      type: valor < 0 ? 'EXPENSE' : 'INCOME',
    })
  }
  if (!rows.length) return null
  const tot = re2 => { const m = texto.match(re2); return m ? Math.abs(parseMonto(m[1])) : null }
  const cuenta = /CUENTA CORRIENTE/i.test(texto) ? 'Cuenta corriente' : 'Cuenta de ahorros'
  return {
    bank: `Bancolombia · ${cuenta}`,
    period: { from: `${y1}-${String(m1).padStart(2, '0')}-${String(d1).padStart(2, '0')}`, to: `${y2}-${String(m2).padStart(2, '0')}-${String(d2).padStart(2, '0')}` },
    totals: { abonos: tot(/TOTAL ABONOS\s+\$\s*([\d,.]+)/i), cargos: tot(/TOTAL CARGOS\s+\$\s*([\d,.]+)/i) },
    rows, method: 'exacto',
  }
}

// TRM: primero la del extracto; si no aparece, la oficial (Banco de la República vía datos.gov.co)
async function trmDe(texto) {
  const m = texto.match(/(?:TRM|TASA\s+(?:DE\s+)?CAMBIO|TASA\s+REPRESENTATIVA)[^\d]{0,40}([\d.,]{4,})/i)
  const v = m ? parseMonto(m[1]) : null
  if (v && v > 2000 && v < 10000) return { valor: v, fuente: 'del extracto' }
  try {
    const ctrl = new AbortController()
    setTimeout(() => ctrl.abort(), 5000)
    const r = await fetch('https://www.datos.gov.co/resource/32sa-8pi3.json?$order=vigenciadesde%20DESC&$limit=1', { signal: ctrl.signal })
    const t = parseFloat((await r.json())?.[0]?.valor)
    if (t > 2000 && t < 10000) return { valor: t, fuente: 'oficial de hoy' }
  } catch { /* sin conexión: se deja sin convertir */ }
  return null
}

/** Lector con IA para formatos desconocidos. Solo envía líneas con fecha y monto, sin números de cuenta. */
async function parseConIA(texto) {
  const lineas = texto.split('\n')
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(l => (/\b\d{1,2}[/.-]\d{1,2}\b|\b\d{1,2}\s+(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)/i.test(l)) && /\d[\d.,]*\d/.test(l))
    .map(l => l.replace(/\b\d{8,}\b/g, '****').replace(/\b(\d{4}[ -]){3}\d{4}\b/g, '****'))
  if (!lineas.length) throw httpError('No encontré movimientos en el archivo', 422)
  const hoy = dayKey(new Date())
  const rows = []
  for (let i = 0; i < lineas.length && i < 360; i += 60) {
    if (i) await sleep(15000) // respetar el límite de tokens por minuto de Groq
    const prompt = `/no_think
Extrae los movimientos de estas líneas de un extracto bancario colombiano. Hoy es ${hoy}.
Responde SOLO con JSON válido: {"movimientos":[{"fecha":"AAAA-MM-DD","descripcion":"texto","monto":número positivo,"tipo":"gasto" | "ingreso" | "pago_tarjeta","moneda":"COP" | "USD"}]}
Reglas: ignora saldos, totales, cupos, intereses informativos y líneas que no sean movimientos. En tarjetas de crédito, las compras son "gasto" y los pagos a la tarjeta son "pago_tarjeta". Montos sin separadores de miles. Si el extracto tiene una sección en dólares, marca esos movimientos con moneda "USD" y deja el monto en dólares (con decimales); el resto es "COP". Si falta el año, infiérelo sin usar fechas futuras.
Líneas:
${lineas.slice(i, i + 60).join('\n')}`
    let raw = await callClaude(prompt, null, 'image/jpeg', 3000)
    raw = parseJSON(String(raw).replace(/<think>[\s\S]*?<\/think>/g, ''))
    let json
    try { json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) } catch { continue }
    for (const mv of json.movimientos || []) {
      const date = parseFecha(mv.fecha)
      const amount = Math.abs(Number(mv.monto))
      if (!date || !(amount > 0) || date > hoy) continue
      rows.push({
        date, description: limpiarDesc(mv.descripcion).slice(0, 120), amount,
        type: mv.tipo === 'ingreso' ? 'INCOME' : mv.tipo === 'pago_tarjeta' ? 'TRANSFER' : 'EXPENSE',
        currency: String(mv.moneda || 'COP').toUpperCase() === 'USD' ? 'USD' : 'COP',
      })
    }
  }
  if (!rows.length) throw httpError('No pude leer movimientos de este extracto', 422)
  if (rows.some(r => r.currency === 'USD')) {
    const trm = await trmDe(texto)
    for (const r of rows) {
      if (r.currency !== 'USD') continue
      if (trm) {
        const usd = r.amount
        r.amount = Math.round(usd * trm.valor)
        r.description = `${r.description} (US$${usd})`
        r.note = `Monto en dólares convertido con TRM $${Math.round(trm.valor).toLocaleString('es-CO')} (${trm.fuente})`
      } else {
        r.note = 'Monto en dólares sin convertir: revísalo antes de importar'
        r.unconverted = true
      }
    }
  }
  return rows
}

// ---------- CSV y Excel ----------
function parseCSV(texto) {
  const primeras = texto.split(/\r?\n/).slice(0, 10).join('\n')
  const sep = [';', ',', '\t'].sort((a, b) => primeras.split(b).length - primeras.split(a).length)[0]
  const filas = []
  let fila = [], campo = '', comillas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++ } else if (c === '"') comillas = false; else campo += c
    } else if (c === '"') comillas = true
    else if (c === sep) { fila.push(campo); campo = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      fila.push(campo); filas.push(fila); fila = []; campo = ''
    } else campo += c
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila) }
  return filas
}

async function parseExcel(buffer) {
  const ExcelJS = require('exceljs')
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  const ws = wb.worksheets.find(w => w.rowCount > 1) || wb.worksheets[0]
  const filas = []
  ws.eachRow({ includeEmpty: false }, row => {
    const vals = row.values.slice(1).map(v => (v && typeof v === 'object' && !(v instanceof Date)) ? (v.result ?? v.text ?? '') : v)
    filas.push(vals)
  })
  return filas
}

function parseTabla(filas) {
  const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  let h = -1
  for (let i = 0; i < Math.min(filas.length, 25); i++) {
    const t = filas[i].map(norm).join('|')
    if (/fecha/.test(t) && /(valor|monto|importe|debito|credito|cargo|abono)/.test(t)) { h = i; break }
  }
  if (h < 0) return null
  const cab = filas[h].map(norm)
  const col = re => cab.findIndex(c => re.test(c))
  const cFecha = col(/fecha/)
  const cDesc = col(/(descrip|concepto|detalle|referencia|comercio|movimiento)/)
  const cValor = col(/^(valor|monto|importe)/)
  const cDeb = col(/(debito|cargo|retiro|salida|egreso)/)
  const cCred = col(/(credito|abono|deposito|entrada|ingreso)/)
  const rows = []
  for (const f of filas.slice(h + 1)) {
    const date = parseFecha(f[cFecha])
    if (!date) continue
    let valor = cValor >= 0 ? parseMonto(f[cValor]) : null
    if (valor === null && (cDeb >= 0 || cCred >= 0)) {
      const deb = Math.abs(parseMonto(f[cDeb]) || 0), cred = Math.abs(parseMonto(f[cCred]) || 0)
      valor = cred - deb
    }
    if (!valor) continue
    rows.push({ date, description: limpiarDesc(f[cDesc] ?? '').slice(0, 120) || 'Movimiento', amount: Math.abs(valor), type: valor < 0 ? 'EXPENSE' : 'INCOME' })
  }
  return rows.length ? rows : null
}

// ---------- Categorías: historial del usuario + reglas de comercios colombianos ----------
const REGLAS = [
  [/AVANCE/, null, 'TRANSFER'],
  [/INTERESES CORRIENTES|INTERES(ES)? DE MORA|CUOTA DE MANEJO|COMISION|\bGMF\b|4X1000|SEGURO DEUDOR/, ['Deudas', 'Otros']],
  [/PAGO DE NOMI|NOMINA|SALARIO/, null, 'INCOME'],
  [/INTERESES? AHORROS|ABONO INTERESES/, null, 'INCOME'],
  [/TRANSFERENCIAS? A NEQUI|PAGO AUTOM TC|PAGO TC|PAGO TARJETA|TRANSFERENCIA TC|ABONO A TC|PAGO A TU TARJETA/, null, 'TRANSFER'],
  [/APPLE\.COM|ICLOUD|GOOGLE ?PLAY|GOOGLE \*|MICROSOFT|OPENAI|CHATGPT|ANTHROPIC|CLAUDE\.AI|ADOBE|CANVA/, ['Suscripciones', 'Entretenimiento', 'Tecnología']],
  [/MERCADOLIBRE|MERCADO LIBRE|AMAZON|TEMU|SHEIN|FALABELLA|ALKOSTO|KTRONIX/, ['Compras', 'Tecnología', 'Otros']],
  [/RAPPI|DIDI FOOD|IFOOD|FRISBY|KFC|MCDONALD|BURGER|PIZZA|CREPES|SUBWAY|ALIMENTOS|MERCADO|\bD1\b|\bARA\b|EXITO|CARULLA|OLIMPICA|JUMBO|OXXO|PANADERIA|RESTAURANTE|CAFE|JUAN VALDEZ/, ['Alimentación']],
  [/DIDI|UBER|CABIFY|INDRIVE|METRO|CIVICA|TERPEL|PRIMAX|TEXACO|GASOLINA|PEAJE|PARQUEADERO/, ['Transporte']],
  [/NETFLIX|SPOTIFY|DISNEY|HBO|PRIME VIDEO|YOUTUBE|STEAM|PLAYSTATION|XBOX|CINE/, ['Entretenimiento', 'Suscripciones']],
  [/DROGUERIA|FARMATODO|CRUZ VERDE|CLINICA|LABORATORIO|\bEPS\b/, ['Salud']],
  [/\bEPM\b|CLARO|TIGO|MOVISTAR|\bWOM\b|\bETB\b|GAS NATURAL|ACUEDUCTO/, ['Servicios', 'Hogar']],
  [/UNIVERSIDAD|COLEGIO|CURSO|UDEMY|PLATZI/, ['Educación']],
  [/OBLIGACION|CUOTA CREDITO/, ['Deudas']],
]
const claveDesc = d => String(d).toUpperCase().replace(/^(COMPRA EN|PAGO QR|PAGO PSE|COMPRA)\s+/, '').replace(/[^A-ZÑ ]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 2).join(' ')

async function categorizador(userId) {
  const [cats, hist] = await Promise.all([
    prisma.category.findMany({ where: { OR: [{ userId }, { userId: null }] }, select: { id: true, name: true } }),
    prisma.transaction.findMany({
      where: { userId, categoryId: { not: null } }, orderBy: { date: 'desc' }, take: 800,
      select: { description: true, categoryId: true },
    }),
  ])
  const porNombre = Object.fromEntries(cats.map(c => [c.name.toLowerCase(), c.id]))
  const aprendido = {}
  for (const t of hist) {
    const k = claveDesc(t.description)
    if (!k) continue
    aprendido[k] ||= {}
    aprendido[k][t.categoryId] = (aprendido[k][t.categoryId] || 0) + 1
  }
  return desc => {
    const D = String(desc).toUpperCase()
    let type = null, categoryId = null
    for (const [re, nombres, tipo] of REGLAS) {
      if (!re.test(D)) continue
      if (tipo) type = tipo
      if (nombres) categoryId = nombres.map(n => porNombre[n.toLowerCase()]).find(Boolean) || null
      break
    }
    const k = aprendido[claveDesc(desc)]
    if (k) categoryId = Object.entries(k).sort((a, b) => b[1] - a[1])[0][0]
    return { type, categoryId }
  }
}

// ---------- Vista previa ----------
async function preview(userId, file, password) {
  if (!file) throw httpError('Sube un archivo')
  const ext = (file.originalname.split('.').pop() || '').toLowerCase()
  let res

  if (ext === 'pdf') {
    const texto = await pdfATexto(file.buffer, password)
    if (texto.replace(/\s/g, '').length < 50) throw httpError('El PDF no tiene texto (parece escaneado). Descarga el extracto digital desde la sucursal virtual.', 422)
    res = parseBancolombia(texto)
    if (!res) res = { bank: detectarBanco(texto), period: null, totals: null, rows: await parseConIA(texto), method: 'ia' }
  } else if (ext === 'csv' || ext === 'txt') {
    let texto = file.buffer.toString('utf8')
    if (texto.includes('\uFFFD')) texto = file.buffer.toString('latin1')
    texto = texto.replace(/^\uFEFF/, '')
    const rows = parseTabla(parseCSV(texto))
    res = { bank: detectarBanco(texto), period: null, totals: null, rows: rows || await parseConIA(texto), method: rows ? 'tabla' : 'ia' }
  } else if (ext === 'xlsx') {
    const filas = await parseExcel(file.buffer)
    const rows = parseTabla(filas)
    const texto = filas.map(f => f.join('  ')).join('\n')
    res = { bank: detectarBanco(texto), period: null, totals: null, rows: rows || await parseConIA(texto), method: rows ? 'tabla' : 'ia' }
  } else if (ext === 'xls') {
    throw httpError('El formato .xls antiguo no es compatible. Ábrelo en Excel y guárdalo como .xlsx')
  } else {
    throw httpError('Formato no compatible. Usa PDF, CSV o Excel (.xlsx)')
  }

  const cat = await categorizador(userId)

  // Duplicados: mismo monto con ±1 día respecto a movimientos ya registrados
  const fechas = res.rows.map(r => r.date).sort()
  const desde = new Date(`${fechas[0]}T05:00:00Z`); desde.setUTCDate(desde.getUTCDate() - 1)
  const hasta = new Date(`${fechas[fechas.length - 1]}T05:00:00Z`); hasta.setUTCDate(hasta.getUTCDate() + 2)
  const existentes = await prisma.transaction.findMany({
    where: { userId, date: { gte: desde, lt: hasta } }, select: { amount: true, date: true, description: true },
  })
  const usados = new Set()
  const rows = res.rows.map((r, i) => {
    const sug = cat(r.description)
    const type = r.type === 'TRANSFER' ? 'TRANSFER' : sug.type === 'TRANSFER' ? 'TRANSFER' : r.type
    const ms = new Date(`${r.date}T12:00:00-05:00`).getTime()
    const idx = existentes.findIndex((e, j) => !usados.has(j) && Math.abs(e.amount - r.amount) < 1 && Math.abs(e.date.getTime() - ms) <= 1.5 * 864e5)
    if (idx >= 0) usados.add(idx)
    return {
      id: i, ...r, type,
      categoryId: type === 'TRANSFER' ? null : sug.categoryId,
      duplicate: idx >= 0 ? existentes[idx].description : null,
      selected: idx < 0 && type !== 'TRANSFER' && !r.unconverted,
      note: r.note || null,
    }
  })

  if (res.method === 'ia' && rows.length) {
    const max = rows.reduce((m, r) => (r.date > m ? r.date : m), rows[0].date)
    const lim = new Date(`${max}T00:00:00Z`); lim.setUTCDate(lim.getUTCDate() - 40)
    const limite = lim.toISOString().slice(0, 10)
    for (const r of rows) {
      if (r.date < limite) { r.selected = false; r.note = 'Fecha anterior al periodo del extracto: puede ser una compra diferida a cuotas que ya registraste' }
    }
  }

  const sum = t => Math.round(res.rows.filter(r => r.type === t).reduce((s, r) => s + r.amount, 0) * 100) / 100
  const check = res.totals ? {
    abonosOk: res.totals.abonos !== null ? Math.abs(sum('INCOME') - res.totals.abonos) < 1 : null,
    cargosOk: res.totals.cargos !== null ? Math.abs(sum('EXPENSE') - res.totals.cargos) < 1 : null,
    leido: { abonos: sum('INCOME'), cargos: sum('EXPENSE') },
    extracto: res.totals,
  } : null

  return { bank: res.bank, period: res.period, method: res.method, check, rows }
}

// ---------- Confirmar ----------
async function commit(userId, rows, bank) {
  if (!Array.isArray(rows) || !rows.length) throw httpError('No hay movimientos seleccionados')
  if (rows.length > 1000) throw httpError('Demasiados movimientos en una sola importación')
  const cats = await prisma.category.findMany({ where: { OR: [{ userId }, { userId: null }] }, select: { id: true } })
  const permitidas = new Set(cats.map(c => c.id))
  const data = []
  for (const r of rows) {
    const date = parseFecha(r.date)
    const amount = Math.round(Math.abs(Number(r.amount)) * 100) / 100
    const type = ['INCOME', 'EXPENSE', 'TRANSFER'].includes(r.type) ? r.type : null
    if (!date || !(amount > 0) || !type) continue
    data.push({
      userId, amount, type, source: 'IMPORT',
      description: limpiarDesc(r.description).slice(0, 190) || 'Movimiento importado',
      date: new Date(`${date}T12:00:00-05:00`),
      categoryId: type !== 'TRANSFER' && permitidas.has(r.categoryId) ? r.categoryId : null,
      notes: `Importado de extracto ${limpiarDesc(bank || '').slice(0, 60)}`.trim(),
    })
  }
  if (!data.length) throw httpError('Ningún movimiento es válido')
  const { count } = await prisma.transaction.createMany({ data })

  // Recalcular presupuestos de cada categoría y mes afectados
  const vistos = new Set()
  for (const t of data) {
    if (t.type !== 'EXPENSE' || !t.categoryId) continue
    const k = `${t.categoryId}|${dayKey(t.date).slice(0, 7)}`
    if (vistos.has(k)) continue
    vistos.add(k)
    try {
      await budgetService.updateSpent(userId, t.categoryId, t.date)
      await alertService.checkBudgetAlerts(userId, t.categoryId, t.date)
    } catch (err) { logger.error('Importación presupuesto: ' + err.message) }
  }
  return count
}

module.exports = { preview, commit }
