const sharp         = require('sharp')
const { syncMealExpense } = require('../services/mealExpenseService')
const prisma         = require('../config/prisma')
const foodOcrService = require('../services/foodOcrService')
const logger         = require('../config/logger')

exports.list = async (req,res) => {
  try {
    const { date, from, to } = req.query
    const where = { userId: req.user.id }
    if (date) { const s=new Date(date); s.setHours(0,0,0,0); const e=new Date(date); e.setHours(23,59,59,999); where.date={ gte:s, lte:e } }
    else if (from||to) { where.date={}; if(from) where.date.gte=new Date(from); if(to) where.date.lte=new Date(to) }
    res.json({ data: await prisma.meal.findMany({ where, orderBy:{ date:'desc' } }) })
  } catch { res.status(500).json({ error:'Error' }) }
}

exports.create = async (req,res) => {
  try {
    const { name, mealType, calories, proteinG, carbsG, fatG, date, source } = req.body
    if (!name || calories===undefined) return res.status(400).json({ error:'Nombre y calorías requeridos' })
    const meal = await prisma.meal.create({ data:{ name, mealType:mealType||'OTHER', calories:parseFloat(calories), proteinG:parseFloat(proteinG)||0, carbsG:parseFloat(carbsG)||0, fatG:parseFloat(fatG)||0, source:source||'MANUAL', date:date?new Date(date):new Date(), userId:req.user.id } })
    const final = parseFloat(req.body.price) > 0 ? await syncMealExpense({ meal, price: req.body.price, userId: req.user.id }) : meal
    res.status(201).json({ data: final })
  } catch { res.status(500).json({ error:'Error' }) }
}

exports.update = async (req,res) => {
  try {
    const { name, mealType, calories, proteinG, carbsG, fatG } = req.body
    const r = await prisma.meal.updateMany({ where:{ id:req.params.id, userId:req.user.id }, data:{ ...(name&&{name}), ...(mealType&&{mealType}), ...(calories!==undefined&&{ calories:parseFloat(calories) }), ...(proteinG!==undefined&&{ proteinG:parseFloat(proteinG) }), ...(carbsG!==undefined&&{ carbsG:parseFloat(carbsG) }), ...(fatG!==undefined&&{ fatG:parseFloat(fatG) }) } })
    if (r.count && (req.body.price !== undefined || req.body.name || req.body.mealType)) {
      const meal = await prisma.meal.findFirst({ where:{ id:req.params.id, userId:req.user.id } })
      if (meal) await syncMealExpense({ meal, price: req.body.price !== undefined ? req.body.price : meal.price, userId: req.user.id })
    }
    if(r.count===0) return res.status(404).json({ error:'No encontrada' })
    res.json({ message:'Actualizado' })
  } catch { res.status(500).json({ error:'Error' }) }
}

exports.remove = async (req,res) => { try { const m = await prisma.meal.findFirst({ where:{ id:req.params.id, userId:req.user.id }, select:{ transactionId:true } }); await prisma.meal.deleteMany({ where:{ id:req.params.id, userId:req.user.id } }); if (m?.transactionId) await prisma.transaction.deleteMany({ where:{ id:m.transactionId, userId:req.user.id } }); res.json({ message:'Eliminado' }) } catch { res.status(500).json({ error:'Error' }) } }

exports.scanPhoto = async (req,res) => {
  try {
    if (!req.file) return res.status(400).json({ error:'No se recibió imagen' })
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error:'ANTHROPIC_API_KEY no configurada' })
    const buffer = await sharp(req.file.buffer).resize({ width:1200, withoutEnlargement:true }).jpeg({ quality:85 }).toBuffer()
    const result = await foodOcrService.analyzeMealPhoto(buffer.toString('base64'), 'image/jpeg')
    if (!result.success) return res.status(422).json({ error:'No se pudo analizar', detail:result.error })
    res.json({ data: result })
  } catch (err) { logger.error(err.message); res.status(500).json({ error:'Error procesando foto' }) }
}

exports.estimateFromText = async (req,res) => {
  try {
    const { description } = req.body
    if (!description) return res.status(400).json({ error:'Descripción requerida' })
    const result = await foodOcrService.estimateFromText(description)
    if (!result) return res.status(422).json({ error:'No se pudo estimar' })
    res.json({ data: result })
  } catch { res.status(500).json({ error:'Error' }) }
}

exports.getTodaySummary = async (req,res) => {
  try {
    const start = new Date(); start.setHours(0,0,0,0)
    const end   = new Date(); end.setHours(23,59,59,999)
    const meals = await prisma.meal.findMany({ where:{ userId:req.user.id, date:{ gte:start, lte:end } }, orderBy:{ date:'asc' } })
    const totals = meals.reduce((acc,m) => ({ calories:acc.calories+m.calories, proteinG:acc.proteinG+m.proteinG, carbsG:acc.carbsG+m.carbsG, fatG:acc.fatG+m.fatG }), { calories:0, proteinG:0, carbsG:0, fatG:0 })
    const profile = await prisma.fitnessProfile.findUnique({ where:{ userId:req.user.id } })
    res.json({ data:{ meals, totals, targets: profile ? { calories:profile.targetCalories, proteinG:profile.targetProteinG, carbsG:profile.targetCarbsG, fatG:profile.targetFatG } : null } })
  } catch { res.status(500).json({ error:'Error' }) }
}
