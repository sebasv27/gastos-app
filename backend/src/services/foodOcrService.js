// src/services/foodOcrService.js
const { callClaude, parseJSON } = require('./claudeService')
const logger = require('../config/logger')

exports.analyzeMealPhoto = async (base64Image, mediaType = 'image/jpeg') => {
  const prompt = `Analiza esta foto de comida colombiana y estima sus valores nutricionales.

Responde ÚNICAMENTE con un objeto JSON válido sin backticks:
{
  "name": "<nombre descriptivo del plato, ej. 'Arroz con pollo y aguacate'>",
  "mealType": "<BREAKFAST|LUNCH|DINNER|SNACK|OTHER>",
  "calories": <número entero, calorías totales del plato completo>,
  "proteinG": <número, gramos de proteína>,
  "carbsG": <número, gramos de carbohidratos>,
  "fatG": <número, gramos de grasa>,
  "items": ["<ingrediente 1>", "<ingrediente 2>"],
  "confidence": <0 a 1>,
  "portionNote": "<nota sobre el tamaño de porción asumido>"
}

Asume porciones colombianas típicas (una porción de arroz = 1 taza, etc.)`

  try {
    const raw  = await callClaude(prompt, base64Image, mediaType)
    const json = JSON.parse(parseJSON(raw))
    if (typeof json.calories !== 'number' || json.calories <= 0) throw new Error('Calorías inválidas')
    logger.info(`Food OCR: ${json.name} - ${json.calories}kcal`)
    return { ...json, success: true }
  } catch (err) {
    logger.error(`Food OCR error: ${err.message}`)
    return { success: false, error: err.message }
  }
}

exports.estimateFromText = async (description) => {
  try {
    const raw = await callClaude(
      `Estima los valores nutricionales de esta comida: "${description}"
Asume porciones colombianas estándar si no se especifica cantidad.

Responde SOLO con JSON sin backticks:
{"name":"<nombre>","calories":<número>,"proteinG":<número>,"carbsG":<número>,"fatG":<número>,"confidence":<0-1>}`
    )
    const json = JSON.parse(parseJSON(raw))
    if (typeof json.calories !== 'number' || json.calories <= 0) return null
    return { ...json, success: true }
  } catch { return null }
}
