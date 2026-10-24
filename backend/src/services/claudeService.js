// src/services/claudeService.js
// Cliente unificado para todas las llamadas a Groq API

const logger = require('../config/logger')

const callClaude = async (prompt, imageBase64 = null, mediaType = 'image/jpeg', maxTokens = 1024) => {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY no configurada')

  // Groq no soporta imágenes — si hay imagen, agregar descripción al prompt
  const finalPrompt = imageBase64
    ? `${prompt}\n\n[Nota: Se adjuntó una imagen pero el modelo de texto no puede procesarla. Responde con valores estimados razonables y confidence: 0.5]`
    : prompt

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'qwen/qwen3.8-27b',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: finalPrompt }]
    })
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`)
  return data.choices[0].message.content
}

const parseJSON = (raw) =>
  raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

module.exports = { callClaude, parseJSON }
