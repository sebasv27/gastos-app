// backend/src/services/recordService.js
// Récords personales (PRs) y 1RM estimado con la fórmula de Epley.
const prisma = require('../config/prisma')

const MAX_REPS_E1RM = 12

function epley(weightKg, reps) {
  if (!(weightKg > 0) || !(reps > 0) || reps > MAX_REPS_E1RM) return null
  if (reps === 1) return weightKg
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10
}

async function detectPRs({ userId, exerciseId, setId, weightKg, reps }) {
  const previas = await prisma.setLog.findMany({
    where: { exerciseId, isWarmup: false, id: { not: setId }, session: { userId } },
    select: { weightKg: true, reps: true },
  })
  const e1rm = epley(weightKg, reps)
  if (previas.length === 0) return { types: [], first: true, e1rm }

  const maxPeso = Math.max(...previas.map(s => s.weightKg))
  const maxE1 = Math.max(0, ...previas.map(s => epley(s.weightKg, s.reps) || 0))
  const mismoPeso = previas.filter(s => s.weightKg === weightKg)

  const types = []
  if (weightKg > 0 && weightKg > maxPeso) types.push('weight')
  if (e1rm && e1rm > maxE1) types.push('e1rm')
  if (mismoPeso.length && reps > Math.max(...mismoPeso.map(s => s.reps))) types.push('reps')

  return { types, first: false, e1rm, previous: { maxWeight: maxPeso, maxE1rm: maxE1 || null } }
}

async function userRecords(userId) {
  const sets = await prisma.setLog.findMany({
    where: { isWarmup: false, session: { userId } },
    select: {
      weightKg: true, reps: true, createdAt: true, exerciseId: true,
      exercise: { select: { name: true, muscleGroup: true, equipment: true, images: true } },
    },
  })
  const por = {}
  for (const s of sets) {
    const r = (por[s.exerciseId] ||= {
      exerciseId: s.exerciseId, name: s.exercise.name,
      muscleGroup: s.exercise.muscleGroup, equipment: s.exercise.equipment,
      image: s.exercise.images?.[0] ? `/exercise-images/${s.exercise.images[0]}` : null,
      totalSets: 0, lastDate: null, bestWeight: null, bestE1rm: null, bestReps: null,
    })
    r.totalSets++
    if (!r.lastDate || s.createdAt > r.lastDate) r.lastDate = s.createdAt
    if (!r.bestWeight || s.weightKg > r.bestWeight.weightKg ||
        (s.weightKg === r.bestWeight.weightKg && s.reps > r.bestWeight.reps)) {
      r.bestWeight = { weightKg: s.weightKg, reps: s.reps, date: s.createdAt }
    }
    const e1 = epley(s.weightKg, s.reps)
    if (e1 && (!r.bestE1rm || e1 > r.bestE1rm.value)) {
      r.bestE1rm = { value: e1, weightKg: s.weightKg, reps: s.reps, date: s.createdAt }
    }
    if (!r.bestReps || s.reps > r.bestReps.reps) {
      r.bestReps = { reps: s.reps, weightKg: s.weightKg, date: s.createdAt }
    }
  }
  return Object.values(por).sort((a, b) => (b.bestE1rm?.value || 0) - (a.bestE1rm?.value || 0))
}

module.exports = { epley, detectPRs, userRecords }
