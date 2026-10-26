// backend/src/services/habitStatsService.js
// Estadísticas de hábitos calculadas desde los registros (no desde el contador guardado).
const prisma = require('../config/prisma')

const OFFSET_MS = 5 * 60 * 60 * 1000 // Colombia: UTC-5, sin horario de verano
const DIAS_SEMANA = 90

const dayKey = d => new Date(new Date(d).getTime() - OFFSET_MS).toISOString().slice(0, 10)
const addDays = (key, n) => {
  const d = new Date(`${key}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const isoDow = key => { const g = new Date(`${key}T00:00:00Z`).getUTCDay(); return g === 0 ? 7 : g } // 1=lunes … 7=domingo

function parseTarget(t) {
  try {
    const a = (Array.isArray(t) ? t : JSON.parse(t)).map(Number).filter(n => n >= 1 && n <= 7)
    return a.length ? a : [1, 2, 3, 4, 5, 6, 7]
  } catch { return [1, 2, 3, 4, 5, 6, 7] }
}

function analizar(h, hoy) {
  const target = parseTarget(h.targetDays)
  const tset = new Set(target)
  const hechos = new Set(h.logs.filter(l => l.completed).map(l => dayKey(l.date)))
  const inicio = dayKey(h.createdAt)
  // Un día cuenta si estaba programado; hoy solo cuenta si ya se cumplió (el día no ha terminado)
  const cuenta = k => k >= inicio && k <= hoy && tset.has(isoDow(k)) && (k !== hoy || hechos.has(k))

  let racha = 0
  for (let k = hechos.has(hoy) ? hoy : addDays(hoy, -1); k >= inicio; k = addDays(k, -1)) {
    if (!tset.has(isoDow(k))) continue
    if (hechos.has(k)) racha++
    else break
  }

  let mejor = 0, actual = 0
  for (let k = inicio; k <= hoy; k = addDays(k, 1)) {
    if (!cuenta(k)) continue
    if (hechos.has(k)) mejor = Math.max(mejor, ++actual)
    else actual = 0
  }

  const tasa = n => {
    let prog = 0, ok = 0
    for (let i = 0; i < n; i++) {
      const k = addDays(hoy, -i)
      if (!cuenta(k)) continue
      prog++
      if (hechos.has(k)) ok++
    }
    return { prog, ok, pct: prog ? Math.round((ok / prog) * 100) : null }
  }

  const t7 = tasa(7)
  const desde = addDays(hoy, -400)
  return {
    id: h.id, name: h.name, emoji: h.emoji, color: h.color,
    targetDays: target, startDate: inicio,
    doneToday: hechos.has(hoy), currentStreak: racha, bestStreak: mejor,
    totalDone: hechos.size, rate7: t7.pct, rate30: tasa(30).pct,
    days: [...hechos].filter(k => k >= desde).sort(),
    _t7: t7, _cuenta: cuenta, _hechos: hechos,
  }
}

async function userHabitStats(userId) {
  const hoy = dayKey(new Date())
  const habits = await prisma.habit.findMany({
    where: { userId, isActive: true },
    include: { logs: { select: { date: true, completed: true } } },
    orderBy: { createdAt: 'asc' },
  })
  const lista = habits.map(h => analizar(h, hoy))

  const semana = lista.reduce((a, h) => ({ prog: a.prog + h._t7.prog, ok: a.ok + h._t7.ok }), { prog: 0, ok: 0 })

  const weekdays = [1, 2, 3, 4, 5, 6, 7].map(day => ({ day, prog: 0, ok: 0 }))
  for (const h of lista) {
    for (let i = 0; i < DIAS_SEMANA; i++) {
      const k = addDays(hoy, -i)
      if (!h._cuenta(k)) continue
      const w = weekdays[isoDow(k) - 1]
      w.prog++
      if (h._hechos.has(k)) w.ok++
    }
  }

  const top = lista.reduce((b, h) => (!b || h.currentStreak > b.currentStreak ? h : b), null)

  return {
    today: hoy,
    summary: {
      activeHabits: lista.length,
      doneToday: lista.filter(h => h.doneToday).length,
      weekRate: semana.prog ? Math.round((semana.ok / semana.prog) * 100) : null,
      topStreak: top && top.currentStreak > 0 ? { name: top.name, emoji: top.emoji, streak: top.currentStreak } : null,
    },
    weekdays: weekdays.map(w => ({ day: w.day, pct: w.prog ? Math.round((w.ok / w.prog) * 100) : null })),
    habits: lista.map(({ _t7, _cuenta, _hechos, ...h }) => h),
  }
}

module.exports = { userHabitStats, dayKey }
