const prisma      = require('../config/prisma')
const macroService = require('../services/macroService')
const logger       = require('../config/logger')

exports.getProfile = async (req, res) => {
  try { res.json({ data: await prisma.fitnessProfile.findUnique({ where: { userId: req.user.id } }) }) }
  catch { res.status(500).json({ error: 'Error' }) }
}

exports.upsertProfile = async (req, res) => {
  try {
    const { sex, birthDate, heightCm, activityLevel, goal } = req.body
    const profile = await prisma.fitnessProfile.upsert({
      where: { userId: req.user.id },
      update: { ...(sex && {sex}), ...(birthDate && {birthDate: new Date(birthDate)}), ...(heightCm && {heightCm: parseFloat(heightCm)}), ...(activityLevel && {activityLevel}), ...(goal && {goal}) },
      create: { userId: req.user.id, sex: sex||'MALE', birthDate: birthDate ? new Date(birthDate) : null, heightCm: heightCm ? parseFloat(heightCm) : null, activityLevel: activityLevel||'MODERATE', goal: goal||'RECOMP' }
    })
    const updated = await recalcAndSave(req.user.id, profile)
    res.json({ data: updated })
  } catch (err) { logger.error(err.message); res.status(500).json({ error: 'Error' }) }
}

exports.recalculate = async (req, res) => {
  try {
    const profile = await prisma.fitnessProfile.findUnique({ where: { userId: req.user.id } })
    if (!profile) return res.status(404).json({ error: 'Configura tu perfil primero' })
    res.json({ data: await recalcAndSave(req.user.id, profile) })
  } catch (err) { res.status(400).json({ error: err.message }) }
}

const recalcAndSave = async (userId, profile) => {
  const lastWeight = await prisma.bodyLog.findFirst({ where: { userId }, orderBy: { date: 'desc' } })
  if (!lastWeight || !profile.heightCm || !profile.birthDate) return profile
  const macros = macroService.calculateMacros(profile, lastWeight.weightKg)
  return prisma.fitnessProfile.update({ where: { userId }, data: { tdee: macros.tdee, targetCalories: macros.targetCalories, targetProteinG: macros.targetProteinG, targetCarbsG: macros.targetCarbsG, targetFatG: macros.targetFatG } })
}
exports.recalcAndSave = recalcAndSave
