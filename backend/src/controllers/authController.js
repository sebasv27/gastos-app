const bcrypt  = require('bcryptjs')
const jwt     = require('jsonwebtoken')
const { validationResult } = require('express-validator')
const prisma  = require('../config/prisma')
const { seedDefaultCategories } = require('../services/categoryService')
const { seedDefaultExercises }  = require('../services/exerciseService')

const sign = id => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' })

exports.register = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
  try {
    const { name, email, password, monthlyIncome } = req.body
    if (await prisma.user.findUnique({ where: { email } })) return res.status(409).json({ error: 'Email ya registrado' })
    const hashed = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({ data: { name, email, password: hashed, monthlyIncome: monthlyIncome || 3000000 } })
    await seedDefaultCategories(user.id)
    await seedDefaultExercises()
    const { password:_, ...clean } = user
    res.status(201).json({ user: clean, token: sign(user.id) })
  } catch { res.status(500).json({ error: 'Error al crear usuario' }) }
}

exports.login = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
  try {
    const { email, password } = req.body
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Email o contraseña incorrectos' })
    const { password:_, ...clean } = user
    res.json({ user: clean, token: sign(user.id) })
  } catch { res.status(500).json({ error: 'Error al iniciar sesión' }) }
}

exports.me = async (req, res) => res.json({ user: req.user })

exports.updateProfile = async (req, res) => {
  try {
    const { name, monthlyIncome, pushToken } = req.body
    const user = await prisma.user.update({ where: { id: req.user.id }, data: { name, monthlyIncome, pushToken }, select: { id:true, name:true, email:true, monthlyIncome:true } })
    res.json({ user })
  } catch { res.status(500).json({ error: 'Error al actualizar' }) }
}

exports.logout = (req, res) => res.json({ message: 'Sesión cerrada' })
