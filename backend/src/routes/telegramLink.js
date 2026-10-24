const router = require('express').Router()
const auth   = require('../middleware/auth')
const prisma = require('../config/prisma')
router.use(auth)
// Guardar el chatId de Telegram del usuario
router.post('/link', async (req, res) => {
  try {
    const { chatId } = req.body
    if (!chatId) return res.status(400).json({ error: 'chatId requerido' })
    await prisma.user.update({ where: { id: req.user.id }, data: { telegramChatId: String(chatId) } })
    res.json({ message: 'Telegram vinculado correctamente' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})
router.delete('/unlink', async (req, res) => {
  try {
    await prisma.user.update({ where: { id: req.user.id }, data: { telegramChatId: null } })
    res.json({ message: 'Telegram desvinculado' })
  } catch { res.status(500).json({ error: 'Error' }) }
})
module.exports = router