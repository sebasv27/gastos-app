const multer = require('multer')
const storage = multer.memoryStorage()
const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg','image/jpg','image/png','image/webp','image/heic']
  allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Solo imágenes JPG, PNG, WEBP'), false)
}
module.exports = multer({ storage, fileFilter, limits: { fileSize: 8 * 1024 * 1024 } })
