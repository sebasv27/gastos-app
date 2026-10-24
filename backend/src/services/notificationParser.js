// src/services/notificationParser.js
const { callClaude, parseJSON } = require('./claudeService')
const logger = require('../config/logger')

const PATTERNS = {
  BANCOLOMBIA: [
    /compra\s+por\s+\$?([\d.,]+)\s+en\s+(.+?)(?:\.|$)/i,
    /retiro\s+por\s+\$?([\d.,]+)/i,
    /transferencia\s+(?:de\s+)?\$?([\d.,]+)/i,
    /pago\s+(?:de\s+)?\$?([\d.,]+)\s+a\s+(.+?)(?:\.|$)/i,
  ],
  NEQUI: [
    /te\s+llegaron\s+\$?([\d.,]+)/i,
    /enviaste\s+\$?([\d.,]+)\s+a\s+(.+?)(?:\.|$)/i,
    /pagaste\s+\$?([\d.,]+)(?:\s+en\s+(.+?))?(?:\.|$)/i,
    /recibiste\s+\$?([\d.,]+)/i,
  ],
  DAVIPLATA: [
    /transferencia\s+enviada\s+\$?([\d.,]+)/i,
    /pago\s+exitoso\s+\$?([\d.,]+)/i,
  ],
}

const INCOME_KEYWORDS = ['te llegaron', 'recibiste', 'recibido', 'te enviaron', 'abono', 'consignación']

const parseAmount = (raw) => {
  const clean = raw.replace(/[$\s]/g, '').replace(/\./g, '').replace(',', '.')
  return parseFloat(clean)
}

const detectBank = (appPackage, title, text) => {
  const c = `${appPackage} ${title} ${text}`.toLowerCase()
  if (c.includes('bancolombia')) return 'BANCOLOMBIA'
  if (c.includes('nequi'))       return 'NEQUI'
  if (c.includes('daviplata'))   return 'DAVIPLATA'
  return 'UNKNOWN'
}

const parseWithRegex = (text, bank) => {
  for (const pattern of (PATTERNS[bank] || [])) {
    const match = text.match(pattern)
    if (match) {
      const amount = parseAmount(match[1])
      if (isNaN(amount) || amount <= 0) continue
      const description = match[2]?.trim() || text.substring(0, 60)
      const type = INCOME_KEYWORDS.some(k => text.toLowerCase().includes(k)) ? 'INCOME' : 'EXPENSE'
      return { amount, description, type, confidence: 0.85, method: 'regex' }
    }
  }
  return null
}

const parseWithClaude = async (rawText, bank) => {
  try {
    const raw = await callClaude(
      `Analiza esta notificación bancaria colombiana del banco ${bank} y extrae los datos.
Notificación: "${rawText}"

Responde SOLO con JSON sin backticks:
{"amount":<número en pesos>,"description":"<descripción>","type":"<EXPENSE o INCOME>","confidence":<0-1>}`
    )
    const json = JSON.parse(parseJSON(raw))
    if (!json.amount || json.amount <= 0 || json.confidence < 0.4) return null
    return { ...json, method: 'claude' }
  } catch (err) {
    logger.error(`Claude parser error: ${err.message}`)
    return null
  }
}

exports.parseNotification = async ({ appPackage = '', title = '', text = '', timestamp }) => {
  const fullText = `${title} ${text}`.trim()
  const bank     = detectBank(appPackage, title, text)
  const regex    = parseWithRegex(fullText, bank)
  if (regex) return { ...regex, bank, rawText: fullText, timestamp }
  const claude   = await parseWithClaude(fullText, bank)
  if (claude) return { ...claude, bank, rawText: fullText, timestamp }
  return null
}
