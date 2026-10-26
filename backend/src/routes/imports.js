const router = require('express').Router()
const multer = require('multer')
const auth = require('../middleware/auth')
const ctrl = require('../controllers/importController')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => cb(null, /\.(pdf|csv|txt|xlsx|xls)$/i.test(file.originalname)),
})

router.use(auth)
router.post('/preview', upload.single('file'), ctrl.preview)
router.post('/commit', ctrl.commit)
module.exports = router
