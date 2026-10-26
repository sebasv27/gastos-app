const router = require('express').Router()
const auth = require('../middleware/auth')
const ctrl = require('../controllers/forecastController')
router.use(auth)
router.get('/', ctrl.get)
router.get('/insights', ctrl.insights)
router.post('/insights', ctrl.refreshInsights)
module.exports = router
