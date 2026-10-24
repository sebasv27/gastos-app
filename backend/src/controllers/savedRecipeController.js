const prisma = require('../config/prisma')
const logger = require('../config/logger')

exports.list = async (req, res) => {
  try {
    const { favorite } = req.query
    const where = { userId: req.user.id }
    if (favorite === 'true') where.isFavorite = true
    const data = await prisma.savedRecipe.findMany({ where, orderBy: [{ isFavorite:'desc' }, { timesUsed:'desc' }, { createdAt:'desc' }] })
    res.json({ data })
  } catch { res.status(500).json({ error: 'Error al obtener recetas' }) }
}

exports.save = async (req, res) => {
  try {
    const { name, mealType, emoji, style, difficulty, prepMinutes, cookMinutes, servings, calories, proteinG, carbsG, fatG, whyRecommended, ingredients, steps, tips, tags, searchQuery } = req.body
    if (!name || calories === undefined) return res.status(400).json({ error: 'Nombre y calorías requeridos' })
    const existing = await prisma.savedRecipe.findFirst({ where: { userId: req.user.id, name: { equals: name, mode: 'insensitive' } } })
    if (existing) return res.status(409).json({ error: 'Ya tienes esta receta guardada', data: existing })
    const recipe = await prisma.savedRecipe.create({
      data: { userId: req.user.id, name, mealType: mealType||'OTHER', emoji: emoji||'🍽️', style, difficulty: difficulty||1, prepMinutes: prepMinutes||0, cookMinutes: cookMinutes||0, servings: servings||1, calories: parseFloat(calories), proteinG: parseFloat(proteinG)||0, carbsG: parseFloat(carbsG)||0, fatG: parseFloat(fatG)||0, whyRecommended, ingredients: ingredients||[], steps: steps||[], tips: tips||[], tags: tags||[], searchQuery }
    })
    logger.info('Receta guardada: ' + name)
    res.status(201).json({ data: recipe })
  } catch (err) { logger.error('saveRecipe: ' + err.message); res.status(500).json({ error: 'Error al guardar' }) }
}

exports.toggleFavorite = async (req, res) => {
  try {
    const recipe = await prisma.savedRecipe.findFirst({ where: { id: req.params.id, userId: req.user.id } })
    if (!recipe) return res.status(404).json({ error: 'No encontrada' })
    const updated = await prisma.savedRecipe.update({ where: { id: req.params.id }, data: { isFavorite: !recipe.isFavorite } })
    res.json({ data: updated })
  } catch { res.status(500).json({ error: 'Error' }) }
}

exports.logUse = async (req, res) => {
  try {
    await prisma.savedRecipe.updateMany({ where: { id: req.params.id, userId: req.user.id }, data: { timesUsed: { increment: 1 }, lastUsedAt: new Date() } })
    res.json({ message: 'Uso registrado' })
  } catch { res.status(500).json({ error: 'Error' }) }
}

exports.remove = async (req, res) => {
  try { await prisma.savedRecipe.deleteMany({ where: { id: req.params.id, userId: req.user.id } }); res.json({ message: 'Eliminada' }) }
  catch { res.status(500).json({ error: 'Error' }) }
}
