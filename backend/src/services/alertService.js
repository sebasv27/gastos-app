const prisma     = require('../config/prisma')
const logger     = require('../config/logger')

exports.checkBudgetAlerts = async (userId, categoryId, date) => {
  try {
    const month = date.getMonth() + 1, year = date.getFullYear()
    const budget = await prisma.budget.findUnique({
      where: { userId_categoryId_month_year: { userId, categoryId, month, year } },
      include: { category: true, user: true }
    })
    if (!budget) return
    const pct = budget.spent / budget.amount
    if (pct >= 1) {
      await prisma.alert.create({ data: { userId, type: 'BUDGET_EXCEEDED', message: `⚠️ Superaste el presupuesto de ${budget.category.name} este mes`, metadata: { categoryId, spent: budget.spent, amount: budget.amount } } })
    } else if (pct >= budget.alertAt) {
      const alreadySent = await prisma.alert.findFirst({ where: { userId, type: 'BUDGET_WARNING', createdAt: { gte: new Date(year, month-1, 1) }, metadata: { path: ['categoryId'], equals: categoryId } } })
      if (!alreadySent) {
        await prisma.alert.create({ data: { userId, type: 'BUDGET_WARNING', message: `🔔 Llevas el ${Math.round(pct*100)}% del presupuesto de ${budget.category.name}`, metadata: { categoryId, spent: budget.spent, amount: budget.amount } } })
      }
    }
  } catch (err) { logger.error('checkBudgetAlerts: ' + err.message) }
}
