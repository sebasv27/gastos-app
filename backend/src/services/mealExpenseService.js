// backend/src/services/mealExpenseService.js
// Mantiene sincronizado el gasto vinculado a una comida que tiene precio.
const prisma = require('../config/prisma')

const TIPOS = {
  BREAKFAST: 'Desayuno', LUNCH: 'Almuerzo', DINNER: 'Cena', SNACK: 'Snack', OTHER: 'Comida',
}

async function categoriaAlimentacion(userId) {
  const c = await prisma.category.findFirst({ where: { name: 'Alimentación', OR: [{ userId }, { userId: null }] }, select: { id: true } })
  return c?.id || null
}

function parsePrecio(price) {
  if (price === null || price === undefined || price === '') return null
  if (typeof price === 'number') return price > 0 ? Math.round(price) : null
  // Texto en formato colombiano: "12.000" o "12000"
  const n = parseFloat(String(price).replace(/[^0-9.,]/g, '').replace(/\./g, '').replace(',', '.'))
  return n > 0 ? Math.round(n) : null
}

/**
 * Crea, actualiza o elimina el gasto de una comida según su precio.
 * Devuelve la comida actualizada.
 */
async function syncMealExpense({ meal, price, userId }) {
  const monto = parsePrecio(price)

  // Sin precio: eliminar el gasto vinculado si existía
  if (!monto) {
    if (meal.transactionId) {
      await prisma.transaction.deleteMany({ where: { id: meal.transactionId, userId } })
    }
    return prisma.meal.update({ where: { id: meal.id }, data: { price: null, transactionId: null } })
  }

  const data = {
    amount: monto,
    description: `🍽️ ${TIPOS[meal.mealType] || 'Comida'}: ${meal.name}`,
    date: meal.date,
  }

  // Ya tenía gasto: actualizarlo
  if (meal.transactionId) {
    const r = await prisma.transaction.updateMany({ where: { id: meal.transactionId, userId }, data })
    if (r.count) return prisma.meal.update({ where: { id: meal.id }, data: { price: monto } })
  }

  // No tenía (o lo borraron desde Gastos): crear uno nuevo
  const tx = await prisma.transaction.create({
    data: {
      ...data, type: 'EXPENSE', source: 'MANUAL', userId,
      categoryId: await categoriaAlimentacion(userId),
      notes: 'Creado automáticamente desde Comidas',
    },
  })
  return prisma.meal.update({ where: { id: meal.id }, data: { price: monto, transactionId: tx.id } })
}

module.exports = { syncMealExpense }
