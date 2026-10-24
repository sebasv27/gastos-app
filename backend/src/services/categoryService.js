const prisma = require('../config/prisma')
const DEFAULT_CATEGORIES = [
  { name:'Arriendo', icon:'home', color:'#185FA5' },
  { name:'Alimentación', icon:'shopping-cart', color:'#0F6E56' },
  { name:'Transporte', icon:'car', color:'#854F0B' },
  { name:'Servicios', icon:'bolt', color:'#A32D2D' },
  { name:'Salud', icon:'heart-pulse', color:'#993556' },
  { name:'Educación', icon:'book', color:'#534AB7' },
  { name:'Entretenimiento', icon:'device-gamepad', color:'#3B6D11' },
  { name:'Ropa', icon:'shirt', color:'#854F0B' },
  { name:'Tecnología', icon:'cpu', color:'#185FA5' },
  { name:'Ahorro', icon:'piggy-bank', color:'#0F6E56' },
  { name:'Deuda', icon:'credit-card', color:'#A32D2D' },
  { name:'Otros', icon:'dots-circle', color:'#5F5E5A' },
]
exports.seedDefaultCategories = async (userId) => {
  await prisma.category.createMany({ data: DEFAULT_CATEGORIES.map(c => ({ ...c, userId })), skipDuplicates: true })
}
