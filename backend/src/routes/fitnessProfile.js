const router = require('express').Router()
const auth = require('../middleware/auth')
const ctrl = require('../controllers/fitnessProfileController')
router.use(auth)
router.get('/', ctrl.getProfile)
router.put('/', ctrl.upsertProfile)
router.post('/recalculate', ctrl.recalculate)
module.exports = router