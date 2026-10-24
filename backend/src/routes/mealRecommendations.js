const router = require('express').Router()
const auth   = require('../middleware/auth')
const ctrl   = require('../controllers/mealRecommendationController')
router.use(auth)
router.post('/', ctrl.getRecommendations)
router.get('/image-search', auth, async (req, res) => {
  try {
    const { q } = req.query
    if (!q) return res.json({ url: null })
    const KEY = process.env.GOOGLE_CSE_KEY, CX = process.env.GOOGLE_CSE_ID
    if (!KEY || !CX) return res.json({ url: null })
    const url = 'https://www.googleapis.com/customsearch/v1?key=' + KEY + '&cx=' + CX + '&q=' + encodeURIComponent(q + ' food') + '&searchType=image&num=1&safe=active'
    const resp = await fetch(url)
    const data = await resp.json()
    res.json({ url: data.items?.[0]?.link || null })
  } catch { res.json({ url: null }) }
})
module.exports = router