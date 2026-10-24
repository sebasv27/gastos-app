const prisma = require('../config/prisma')
const svc    = require('../services/mealRecommendationService')
const logger = require('../config/logger')

exports.getRecommendations = async (req, res) => {
  try {
    if (!process.env.GROQ_API_KEY) return res.status(503).json({ error: 'ANTHROPIC_API_KEY no configurada' })
    const { mode='complete_day', style='both' } = req.body
    const userId = req.user.id
    const today = new Date()
    const start = new Date(today); start.setHours(0,0,0,0)
    const end   = new Date(today); end.setHours(23,59,59,999)
    const [meals, profile, lastWeight] = await Promise.all([
      prisma.meal.findMany({ where:{ userId, date:{ gte:start, lte:end } } }),
      prisma.fitnessProfile.findUnique({ where:{ userId } }),
      prisma.bodyLog.findFirst({ where:{ userId }, orderBy:{ date:'desc' } }),
    ])
    const consumed = meals.reduce((acc,m) => ({ calories:acc.calories+m.calories, proteinG:acc.proteinG+m.proteinG, carbsG:acc.carbsG+m.carbsG, fatG:acc.fatG+m.fatG }), { calories:0, proteinG:0, carbsG:0, fatG:0 })
    const targets  = profile ? { calories:profile.targetCalories, proteinG:profile.targetProteinG, carbsG:profile.targetCarbsG, fatG:profile.targetFatG } : null
    const result   = await svc.getRecommendations({ consumed, targets, goal:profile?.goal||'RECOMP', mode, style, weightKg:lastWeight?.weightKg||null })
    if (!result.success) return res.status(422).json({ error:'No se pudieron generar recomendaciones', detail:result.error })
    res.json({ data: { ...result, consumed, targets } })
  } catch (err) { logger.error(err.message); res.status(500).json({ error:'Error generando recomendaciones' }) }
}
