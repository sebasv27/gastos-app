const router = require('express').Router()
const auth   = require('../middleware/auth')
const prisma = require('../config/prisma')
router.use(auth)
router.get('/', async (req,res) => { res.json({ data: await prisma.alert.findMany({ where:{ userId:req.user.id }, orderBy:{ createdAt:'desc' }, take:50 }) }) })
router.put('/read-all', async (req,res) => { await prisma.alert.updateMany({ where:{ userId:req.user.id, isRead:false }, data:{ isRead:true } }); res.json({ message:'Todas leídas' }) })
router.put('/:id/read', async (req,res) => { await prisma.alert.updateMany({ where:{ id:req.params.id, userId:req.user.id }, data:{ isRead:true } }); res.json({ message:'Leída' }) })
module.exports = router