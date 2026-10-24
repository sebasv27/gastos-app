// src/config/seed.js
require('dotenv').config()
const bcrypt = require('bcryptjs')
const prisma = require('./prisma')
const { seedDefaultCategories } = require('../services/categoryService')
const { seedDefaultExercises }  = require('../services/exerciseService')

async function main() {
  console.log('🌱 Seeding...')

  // Usuario demo
  const existing = await prisma.user.findUnique({ where: { email: 'demo@gastos.com' } })
  if (!existing) {
    const hashed = await bcrypt.hash('demo123456', 12)
    const user = await prisma.user.create({
      data: { name: 'Sebs Demo', email: 'demo@gastos.com', password: hashed, monthlyIncome: 3000000 }
    })
    await seedDefaultCategories(user.id)
    console.log('✅ Usuario demo creado: demo@gastos.com / demo123456')
  } else {
    console.log('ℹ️  Usuario demo ya existe')
  }

  await seedDefaultExercises()
  console.log('✅ Ejercicios cargados')
  console.log('✅ Seed completo')
}

main().catch(console.error).finally(() => prisma.$disconnect())
