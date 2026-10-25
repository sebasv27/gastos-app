// backend/src/services/mealExpenseService.js
// Mantiene sincronizado el gasto vinculado a una comida con precio,
// y actualiza presupuestos y alertas igual que un gasto normal.
const prisma = require('../config/prisma')
const budgetService = require('./budgetService')
const alertService = require('./alertService')

const TIPOS = {
  BREAKFAST: 'Desayuno', LUNCH: 'Almuerzo', DINNER: 'Cena', SNACK: 'Snack', OTHER: 'Comida',
}

async function categoriaAlimentacion(userId) {
  const c = await prisma.category.findFirst({
    where: { name: 'Alimentación', OR: [{ userId }, { userId: null }] },
    select: { id: true },
  })
  return c?.id || null
}

function parsePrecio(price) {
  if (price === null || price === undefined || price === '') return null
  if (typeof price === 'number') return price > 0 ? Math.round(price) : null
  const n = parseFloat(String(price).replace(/[^0-9.,]/g, '').replace(/\./g, '').replace(',', '.'))
  return n > 0 ? Math.round(n) : null
}

async function refrescarPresupuesto(userId, categoryId, date) {
  if (!categoryId) return
  try {
    await budgetService.updateSpent(userId, categoryId, date)
    await alertService.checkBudgetAlerts(userId, categoryId, date)
  } catch (err) {
    console.error('[mealExpense] presupuesto:', err.message)
  }
}

/** Elimina el gasto de una comida y recalcula su presupuesto. */
async function removeMealExpense(transactionId, userId) {
  const tx = await prisma.transaction.findFirst({
    where: { id: transactionId, userId }, select: { categoryId: true, date: true },
  })
  if (!tx) return
  await prisma.transaction.deleteMany({ where: { id: transactionId, userId } })
  await refrescarPresupuesto(userId, tx.categoryId, tx.date)
}

/** Crea, actualiza o elimina el gasto de una comida según su precio. */
async function syncMealExpense({ meal, price, userId }) {
  const monto = parsePrecio(price)

  if (!monto) {
    if (meal.transactionId) await removeMealExpense(meal.transactionId, userId)
    return prisma.meal.update({ where: { id: meal.id }, data: { price: null, transactionId: null } })
  }

  const data = {
    amount: monto,
    description: `🍽️ ${TIPOS[meal.mealType] || 'Comida'}: ${meal.name}`,
    date: meal.date,
  }

  if (meal.transactionId) {
    const tx = await prisma.transaction.findFirst({
      where: { id: meal.transactionId, userId }, select: { id: true, categoryId: true },
    })
    if (tx) {
      await prisma.transaction.update({ where: { id: tx.id }, data })
      await refrescarPresupuesto(userId, tx.categoryId, meal.date)
      return prisma.meal.update({ where: { id: meal.id }, data: { price: monto } })
    }
  }

  const tx = await prisma.transaction.create({
    data: {
      ...data, type: 'EXPENSE', source: 'MANUAL', userId,
      categoryId: await categoriaAlimentacion(userId),
      notes: 'Creado automáticamente desde Comidas',
    },
  })
  await refrescarPresupuesto(userId, tx.categoryId, tx.date)
  return prisma.meal.update({ where: { id: meal.id }, data: { price: monto, transactionId: tx.id } })
}

module.exports = { syncMealExpense, removeMealExpense }
