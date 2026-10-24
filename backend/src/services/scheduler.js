const cron = require('node-cron')
const prisma = require('../config/prisma')
const emailService = require('./emailService')
const logger = require('../config/logger')
exports.scheduleJobs = () => {
  cron.schedule('0 8 * * 1', async () => {
    logger.info('Ejecutando resumen semanal...')
    try {
      const users = await prisma.user.findMany({ select: { id:true, name:true, email:true } })
      const weekAgo = new Date(Date.now() - 7*24*60*60*1000)
      for (const user of users) {
        const txs = await prisma.transaction.findMany({ where: { userId:user.id, type:'EXPENSE', date:{ gte:weekAgo } } })
        if (!txs.length) continue
        const totalWeek = txs.reduce((s,t) => s+t.amount, 0)
        await emailService.sendWeeklySummary(user, { totalWeek })
        await prisma.alert.create({ data: { userId:user.id, type:'WEEKLY_SUMMARY', message:`Tu gasto esta semana fue $${totalWeek.toLocaleString('es-CO')}`, metadata:{ totalWeek } } })
      }
    } catch (err) { logger.error('Resumen semanal: ' + err.message) }
  }, { timezone: 'America/Bogota' })
  logger.info('⏰ Jobs programados activos')
}
