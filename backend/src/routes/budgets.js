const router = require('express').Router()
const auth   = require('../middleware/auth')
const prisma = require('../config/prisma')
const budgetService = require('../services/budgetService')
router.use(auth)
router.get('/', async (req,res) => { const {month,year} = req.query; const now=new Date(); res.json({ data: await budgetService.getMonthBudgets(req.user.id, parseInt(month)||now.getMonth()+1, parseInt(year)||now.getFullYear()) }) })
router.post('/', async (req,res) => { try { const {categoryId,amount,month,year,alertAt} = req.body; const now=new Date(); const budget=await prisma.budget.upsert({ where:{ userId_categoryId_month_year:{ userId:req.user.id, categoryId, month:parseInt(month)||now.getMonth()+1, year:parseInt(year)||now.getFullYear() } }, update:{ amount:parseFloat(amount), ...(alertAt&&{ alertAt:parseFloat(alertAt) }) }, create:{ userId:req.user.id, categoryId, amount:parseFloat(amount), month:parseInt(month)||now.getMonth()+1, year:parseInt(year)||now.getFullYear(), alertAt:parseFloat(alertAt)||0.8 }, include:{ category:true } }); res.status(201).json({ data:budget }) } catch(err) { res.status(500).json({ error:err.message }) } })
router.delete('/:id', async (req,res) => { await prisma.budget.deleteMany({ where:{ id:req.params.id, userId:req.user.id } }); res.json({ message:'Eliminado' }) })
module.exports = router