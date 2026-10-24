const prisma = require('../config/prisma')
exports.updateSpent = async (userId, categoryId, date) => {
  const month = date.getMonth() + 1, year = date.getFullYear()
  const start = new Date(year, month-1, 1), end = new Date(year, month, 0, 23, 59, 59)
  const agg = await prisma.transaction.aggregate({
    where: { userId, categoryId, type: 'EXPENSE', date: { gte: start, lte: end } },
    _sum: { amount: true }
  })
  const spent = agg._sum.amount || 0
  await prisma.budget.updateMany({ where: { userId, categoryId, month, year }, data: { spent } })
  return spent
}
exports.getMonthBudgets = async (userId, month, year) => {
  return prisma.budget.findMany({
    where: { userId, month, year },
    include: { category: { select: { id:true, name:true, icon:true, color:true } } },
    orderBy: { amount: 'desc' }
  })
}
