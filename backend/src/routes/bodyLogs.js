const router = require('express').Router()
const auth = require('../middleware/auth')
const ctrl = require('../controllers/bodyLogController')
router.use(auth)
router.get('/progress', ctrl.getProgress)
router.get('/', ctrl.list)
router.post('/', ctrl.create)
router.delete('/:id', ctrl.remove)
module.exports = router