// src/index.js
require('dotenv').config()
const express   = require('express')
const cors      = require('cors')
const helmet    = require('helmet')
const morgan    = require('morgan')
const rateLimit = require('express-rate-limit')

const logger           = require('./config/logger')
const { scheduleJobs }   = require('./services/scheduler')
const { startReminders } = require('./services/reminderService')

const app  = express()
const PORT = process.env.PORT || 4000
const isProd = process.env.NODE_ENV === 'production'

app.use(helmet())
app.set('trust proxy', 1)

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map(s => s.trim())
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) return cb(null, true)
    cb(new Error('CORS bloqueado: ' + origin))
  },
  credentials: true
}))

app.use(rateLimit({ windowMs: 15*60*1000, max: isProd ? 300 : 1000, standardHeaders: true, legacyHeaders: false }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(morgan(isProd ? 'combined' : 'dev'))

// ── Rutas ──────────────────────────────────────────────────────────────────
app.use('/api/auth',              require('./routes/auth'))
app.use('/api/transactions',      require('./routes/transactions'))
app.use('/api/budgets',           require('./routes/budgets'))
app.use('/api/categories',        require('./routes/categories'))
app.use('/api/goals',             require('./routes/goals'))
app.use('/api/alerts',            require('./routes/alerts'))
app.use('/api/dashboard',         require('./routes/dashboard'))
app.use('/api/webhooks',          require('./routes/webhooks'))
app.use('/api/ocr',               require('./routes/ocr'))
app.use('/api/fitness-profile',   require('./routes/fitnessProfile'))
app.use('/api/body-logs',         require('./routes/bodyLogs'))
app.use('/api/exercises',         require('./routes/exercises'))
app.use('/api/routines',          require('./routes/routines'))
app.use('/api/workout-sessions',  require('./routes/workoutSessions'))
app.use('/api/meals',             require('./routes/meals'))
app.use('/api/meal-recommendations', require('./routes/mealRecommendations'))
app.use('/api/tasks',     require('./routes/tasks'))
app.use('/api/habits',    require('./routes/habits'))
app.use('/api/routine',   require('./routes/productivityRoutine'))
app.use('/api/pomodoro',  require('./routes/pomodoro'))
app.use('/api/telegram',  require('./routes/telegramLink'))
app.use('/api/saved-recipes',     require('./routes/savedRecipes'))

app.get('/health', (_, res) => res.json({ status: 'ok', env: process.env.NODE_ENV, ts: new Date().toISOString() }))

app.use((err, req, res, _next) => {
  logger.error(err.stack)
  res.status(err.status || 500).json({ error: err.message || 'Error interno' })
})

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Servidor en http://0.0.0.0:${PORT} [${process.env.NODE_ENV}]`)
  scheduleJobs()
  startReminders()
})

module.exports = app
