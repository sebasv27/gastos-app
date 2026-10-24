const router = require('express').Router()
const auth   = require('../middleware/auth')
const ctrl   = require('../controllers/pomodoroController')
router.use(auth)
router.get('/stats', ctrl.getStats)
router.get('/', ctrl.list)
router.post('/', ctrl.create)
module.exports = router