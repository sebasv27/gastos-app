const router = require('express').Router()
const auth   = require('../middleware/auth')
const upload = require('../config/upload')
const ctrl   = require('../controllers/ocrController')
router.use(auth)
router.post('/receipt', upload.single('receipt'), ctrl.scanReceipt)
router.post('/suggest-category', ctrl.suggestCategory)
module.exports = router