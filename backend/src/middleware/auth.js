const jwt    = require('jsonwebtoken')
const prisma = require('../config/prisma')

const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token requerido' })
    const token   = header.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, name: true, email: true, monthlyIncome: true }
    })
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' })
    req.user = user
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' })
  }
}
module.exports = auth
