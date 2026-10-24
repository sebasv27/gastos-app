const sharp      = require('sharp')
const prisma      = require('../config/prisma')
const ocrService  = require('../services/ocrService')
const logger      = require('../config/logger')

exports.scanReceipt = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error:'No se recibió imagen' })
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error:'ANTHROPIC_API_KEY no configurada' })
    const buffer = await sharp(req.file.buffer).resize({ width:1200, withoutEnlargement:true }).jpeg({ quality:85 }).toBuffer()
    const result = await ocrService.extractReceiptData(buffer.toString('base64'), 'image/jpeg')
    if (!result.success) return res.status(422).json({ error:'No se pudo leer el recibo', detail:result.error })
    let categoryId = null
    if (result.category) {
      const cat = await prisma.category.findFirst({ where:{ name:{ equals:result.category, mode:'insensitive' }, OR:[{ userId:req.user.id },{ isDefault:true }] } })
      if (cat) categoryId = cat.id
    }
    res.json({ data:{ amount:result.amount, description:result.description, merchant:result.merchant, date:result.date, category:result.category, categoryId, confidence:result.confidence, rawTotal:result.raw_total } })
  } catch (err) { logger.error(err.message); res.status(500).json({ error:'Error procesando recibo' }) }
}

exports.suggestCategory = async (req, res) => {
  try {
    const { description } = req.body
    if (!description) return res.status(400).json({ error:'Descripción requerida' })
    const categories = await prisma.category.findMany({ where:{ OR:[{ userId:req.user.id },{ isDefault:true }] }, select:{ id:true, name:true, color:true, icon:true } })
    const suggested = await ocrService.suggestCategory(description, categories)
    res.json({ data: suggested })
  } catch { res.json({ data: null }) }
}
