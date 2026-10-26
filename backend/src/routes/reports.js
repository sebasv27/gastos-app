const router = require('express').Router()
const auth = require('../middleware/auth')
const ctrl = require('../controllers/reportController')
router.use(auth)
router.get('/monthly', ctrl.download)
router.post('/monthly/telegram', ctrl.telegram)
module.exports = router
