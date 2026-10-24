const router = require('express').Router()
const auth   = require('../middleware/auth')
const prisma = require('../config/prisma')
router.use(auth)
router.get('/', async (req,res) => { res.json({ data: await prisma.goal.findMany({ where:{ userId:req.user.id }, orderBy:{ createdAt:'desc' } }) }) })
router.post('/', async (req,res) => { const { name, targetAmount, deadline, icon, color } = req.body; res.status(201).json({ data: await prisma.goal.create({ data:{ name, targetAmount:parseFloat(targetAmount), deadline:deadline?new Date(deadline):null, icon:icon||'target', color:color||'#185FA5', userId:req.user.id } }) }) })
router.put('/:id', async (req,res) => { const { savedAmount, status, name, targetAmount } = req.body; await prisma.goal.updateMany({ where:{ id:req.params.id, userId:req.user.id }, data:{ ...(savedAmount!==undefined&&{ savedAmount:parseFloat(savedAmount) }), ...(status&&{status}), ...(name&&{name}), ...(targetAmount&&{ targetAmount:parseFloat(targetAmount) }) } }); res.json({ message:'Actualizado' }) })
router.delete('/:id', async (req,res) => { await prisma.goal.deleteMany({ where:{ id:req.params.id, userId:req.user.id } }); res.json({ message:'Eliminado' }) })
module.exports = router