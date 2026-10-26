const prisma     = require('../config/prisma')
const logger     = require('../config/logger')

const fmt = n => `$${Math.round(n || 0).toLocaleString('es-CO')}`
const avisar = (userId, payload) => {
  try { require('./pushService').notify(userId, 'budget', payload) }
  catch (err) { logger.error('Push presupuesto: ' + err.message) }
}

exports.checkBudgetAlerts = async (userId, categoryId, date) => {
  try {
    const month = date.getMonth() + 1, year = date.getFullYear()
    const budget = await prisma.budget.findUnique({
      where: { userId_categoryId_month_year: { userId, categoryId, month, year } },
      include: { category: true },
    })
    if (!budget) return
    const pct = budget.spent / budget.amount
    const inicioMes = new Date(year, month - 1, 1)
    // Una alerta de cada tipo por categoría y por mes (antes se repetía con cada gasto)
    const yaEnviada = type => prisma.alert.findFirst({
      where: { userId, type, createdAt: { gte: inicioMes }, metadata: { path: ['categoryId'], equals: categoryId } },
    })
    const metadata = { categoryId, spent: budget.spent, amount: budget.amount }

    if (pct >= 1) {
      if (await yaEnviada('BUDGET_EXCEEDED')) return
      await prisma.alert.create({ data: { userId, type: 'BUDGET_EXCEEDED', message: `⚠️ Superaste el presupuesto de ${budget.category.name} este mes`, metadata } })
      avisar(userId, {
        title: '⚠️ Presupuesto superado',
        body: `${budget.category.name}: llevas ${fmt(budget.spent)} de ${fmt(budget.amount)}`,
        url: '/presupuestos', tag: `budget-${categoryId}`,
      })
    } else if (pct >= budget.alertAt) {
      if (await yaEnviada('BUDGET_WARNING')) return
      await prisma.alert.create({ data: { userId, type: 'BUDGET_WARNING', message: `🔔 Llevas el ${Math.round(pct * 100)}% del presupuesto de ${budget.category.name}`, metadata } })
      avisar(userId, {
        title: `🔔 ${Math.round(pct * 100)}% del presupuesto`,
        body: `${budget.category.name}: llevas ${fmt(budget.spent)} de ${fmt(budget.amount)}`,
        url: '/presupuestos', tag: `budget-${categoryId}`,
      })
    }
  } catch (err) { logger.error('checkBudgetAlerts: ' + err.message) }
}
