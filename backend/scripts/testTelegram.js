// Diagnóstico: usuarios vinculados a Telegram y envío de un mensaje de prueba
require('dotenv').config()
const prisma = new (require('@prisma/client').PrismaClient)()
;(async () => {
  const token = process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  console.log('Token en .env:', token ? 'sí' : 'NO')
  const users = await prisma.user.findMany({ select: { email: true, telegramChatId: true } })
  for (const u of users) console.log(`- ${u.email}: chatId ${u.telegramChatId || '(no vinculado)'}`)
  for (const u of users.filter(u => u.telegramChatId)) {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: u.telegramChatId, text: '✅ Prueba desde el backend de Control de Gastos' }),
    })
    console.log(`Envío a ${u.email}: HTTP ${r.status} ${(await r.text()).slice(0, 160)}`)
  }
  await prisma.$disconnect()
})().catch(e => { console.error('❌', e.message); process.exit(1) })
