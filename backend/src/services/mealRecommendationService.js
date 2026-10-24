// src/services/mealRecommendationService.js
const { callClaude, parseJSON } = require('./claudeService')
const logger = require('../config/logger')

exports.getRecommendations = async ({ consumed, targets, goal, mode, style, weightKg }) => {
  try {
    const remaining = {
      calories: Math.max(0, (targets?.calories || 2000) - (consumed?.calories || 0)),
      proteinG: Math.max(0, (targets?.proteinG || 150) - (consumed?.proteinG || 0)),
      carbsG:   Math.max(0, (targets?.carbsG || 200) - (consumed?.carbsG || 0)),
      fatG:     Math.max(0, (targets?.fatG || 60) - (consumed?.fatG || 0)),
    }

    const goalText = {
      CUT:    'definición (déficit calórico, alta proteína para preservar músculo)',
      RECOMP: 'recomposición corporal (mantenimiento calórico, buena proteína)',
      BULK:   'volumen (superávit calórico, alta proteína para ganar músculo)',
    }[goal] || 'mantenimiento'

    const styleText = {
      colombian: 'comida colombiana y latinoamericana (arroz, pollo, frijoles, lentejas, arepas, plátano, aguacate)',
      flexible:  'cualquier cocina fácil de preparar en casa',
      both:      'mix de comida colombiana e internacional fácil de preparar',
    }[style] || 'variada'

    const modeContext = mode === 'complete_day'
      ? `El usuario YA CONSUMIÓ HOY: ${Math.round(consumed?.calories||0)} kcal, ${Math.round(consumed?.proteinG||0)}g proteína, ${Math.round(consumed?.carbsG||0)}g carbos, ${Math.round(consumed?.fatG||0)}g grasa.
Le FALTAN por consumir: ${Math.round(remaining.calories)} kcal, ${Math.round(remaining.proteinG)}g proteína, ${Math.round(remaining.carbsG)}g carbos, ${Math.round(remaining.fatG)}g grasa.
Genera 3-4 comidas/snacks para COMPLETAR el día cubriendo lo que falta.`
      : `Genera un plan de alimentación COMPLETO para el día: desayuno, almuerzo, cena y un snack.`

    const hour = new Date().getHours()
    const timeOfDay = hour < 11 ? 'mañana' : hour < 15 ? 'mediodía' : hour < 19 ? 'tarde' : 'noche'

    const prompt = `Eres nutricionista experto en fitness que vive en Colombia. Genera recomendaciones de comidas personalizadas.

CONTEXTO DEL USUARIO:
- Peso actual: ${weightKg || 75}kg
- Objetivo fitness: ${goalText}
- Macros objetivo diarios: ${Math.round(targets?.calories||2000)} kcal | Proteína: ${Math.round(targets?.proteinG||150)}g | Carbos: ${Math.round(targets?.carbsG||200)}g | Grasa: ${Math.round(targets?.fatG||60)}g
- Hora actual: ${timeOfDay}
- Estilo de cocina preferido: ${styleText}

${modeContext}

Responde ÚNICAMENTE con un JSON válido sin backticks ni texto adicional:
{
  "mode": "${mode}",
  "summary": "<frase motivacional corta (1 línea)>",
  "recipes": [
    {
      "id": "rec_001",
      "name": "<nombre del plato>",
      "mealType": "<BREAKFAST|LUNCH|DINNER|SNACK>",
      "emoji": "<emoji representativo>",
      "style": "<colombiana|mediterránea|asiática|etc>",
      "difficulty": <1|2|3>,
      "prepMinutes": <número>,
      "cookMinutes": <número>,
      "servings": <número>,
      "calories": <número entero por porción>,
      "proteinG": <número>,
      "carbsG": <número>,
      "fatG": <número>,
      "whyRecommended": "<1-2 frases por qué encaja con el objetivo>",
      "ingredients": [
        { "name": "<ingrediente>", "amount": "<cantidad con unidad>", "proteinG": <número>, "notes": "<opcional>" }
      ],
      "steps": [
        { "step": 1, "text": "<instrucción>", "minutes": <número> }
      ],
      "tips": ["<tip práctico>"],
      "searchQuery": "<query en inglés para buscar imagen del plato>",
      "tags": ["<tag1>", "<tag2>"]
    }
  ]
}

Reglas:
- Genera entre 3 y 5 recetas
- difficulty: 1=muy fácil (<15 min), 2=fácil (15-30 min), 3=moderado (30-60 min)
- Ingredientes conseguibles en D1, Ara, Éxito, Jumbo
- Prioriza alto en proteína si goal es CUT o BULK
- searchQuery en inglés para mejores resultados de imagen`

    const raw  = await callClaude(prompt, null, null, 4096)
    const data = JSON.parse(parseJSON(raw))
    if (!Array.isArray(data.recipes) || data.recipes.length === 0) throw new Error('Sin recetas')
    logger.info(`Recomendaciones generadas: ${data.recipes.length} recetas`)
    return { ...data, success: true }
  } catch (err) {
    logger.error(`mealRecommendationService error: ${err.message}`)
    return { success: false, error: err.message }
  }
}
