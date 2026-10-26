// Ejecuta el resumen semanal (el mismo del botón "Enviar a Telegram") y muestra errores
require('dotenv').config()
const prisma = new (require('@prisma/client').PrismaClient)()
;(async () => {
  const u = await prisma.user.findFirst({ where: { telegramChatId: { not: null } }, select: { id: true, email: true, telegramChatId: true } })
  console.log('Enviando resumen a', u.email, '...')
  const t0 = Date.now()
  await require('../src/services/debtService').weeklySummary(u.id, u.telegramChatId)
  console.log(`✅ Enviado en ${((Date.now() - t0) / 1000).toFixed(1)} s`)
  await prisma.$disconnect()
})().catch(e => { console.error('❌', e.message); process.exit(1) })
