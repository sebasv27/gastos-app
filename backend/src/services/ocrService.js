// src/services/ocrService.js
const { callClaude, parseJSON } = require('./claudeService')
const logger = require('../config/logger')

exports.extractReceiptData = async (base64Image, mediaType = 'image/jpeg') => {
  const prompt = `Analiza este recibo o comprobante de pago colombiano y extrae los datos exactos.

Responde ÚNICAMENTE con un objeto JSON válido sin backticks:
{
  "amount": <número, monto total en pesos colombianos sin puntos ni comas>,
  "description": "<nombre del establecimiento o descripción concisa del gasto>",
  "merchant": "<nombre del comercio o banco>",
  "date": "<fecha en formato YYYY-MM-DD, si no aparece usa la de hoy>",
  "category": "<una de: Alimentación|Transporte|Servicios|Salud|Educación|Entretenimiento|Ropa|Tecnología|Otros>",
  "confidence": <número del 0 al 1>,
  "raw_total": "<texto exacto del monto como aparece en el recibo>"
}

Reglas:
- amount debe ser número entero o decimal, NUNCA string
- Si es transferencia Nequi/Bancolombia, extrae el monto enviado/recibido
- Si no puedes leer con certeza, pon confidence bajo (< 0.6)`

  try {
    const raw  = await callClaude(prompt, base64Image, mediaType)
    const json = JSON.parse(parseJSON(raw))
    if (typeof json.amount !== 'number' || json.amount <= 0) throw new Error('Monto inválido')
    logger.info(`OCR exitoso: $${json.amount} - ${json.merchant}`)
    return { ...json, success: true }
  } catch (err) {
    logger.error(`OCR error: ${err.message}`)
    return { success: false, error: err.message }
  }
}

exports.suggestCategory = async (description, categories) => {
  try {
    const catList = categories.map(c => c.name).join(', ')
    const raw = await callClaude(
      `Dado este gasto: "${description}"\nElige la categoría más apropiada de esta lista: ${catList}\nResponde SOLO con el nombre exacto de la categoría, sin explicación.`
    )
    const suggested = raw.trim()
    return categories.find(c => c.name.toLowerCase() === suggested.toLowerCase()) || null
  } catch { return null }
}
