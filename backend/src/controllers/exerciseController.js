const prisma = require('../config/prisma')
const { epley, userRecords } = require('../services/recordService')

const IMG = '/exercise-images/'
const LIGERO = {
  id: true, name: true, nameEn: true, muscleGroup: true, equipment: true,
  isDefault: true, userId: true, level: true, category: true, images: true,
}
const visibles = userId => ({ OR: [{ userId }, { isDefault: true }] })

exports.list = async (req, res) => {
  try {
    const { muscleGroup, equipment, category, level, q } = req.query
    const limit = Math.min(parseInt(req.query.limit) || 0, 200)
    const offset = parseInt(req.query.offset) || 0
    const where = {
      AND: [
        visibles(req.user.id),
        ...(q ? [{ OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { nameEn: { contains: q, mode: 'insensitive' } },
        ] }] : []),
      ],
      ...(muscleGroup && { muscleGroup }),
      ...(equipment && { equipment }),
      ...(category && { category }),
      ...(level && { level }),
    }
    const [rows, total] = await Promise.all([
      prisma.exercise.findMany({
        where, select: LIGERO,
        // Primero tus ejercicios originales/propios (sin externalId), luego el catálogo
        orderBy: [{ externalId: { sort: 'asc', nulls: 'first' } }, { name: 'asc' }],
        ...(limit && { take: limit, skip: offset }),
      }),
      prisma.exercise.count({ where }),
    ])
    const data = rows.map(({ images, ...e }) => ({ ...e, image: images?.[0] ? IMG + images[0] : null }))
    res.json({ data, total })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error' }) }
}

exports.get = async (req, res) => {
  try {
    const e = await prisma.exercise.findFirst({ where: { id: req.params.id, ...visibles(req.user.id) } })
    if (!e) return res.status(404).json({ error: 'No encontrado' })
    res.json({ data: {
      ...e,
      images: (e.images || []).map(i => IMG + i),
      instructions: e.instructions?.length ? e.instructions : (e.instructionsEn || []),
    } })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error' }) }
}

exports.meta = async (req, res) => {
  try {
    const where = visibles(req.user.id)
    const [grupos, equipos] = await Promise.all([
      prisma.exercise.groupBy({ by: ['muscleGroup'], where, _count: true, orderBy: { muscleGroup: 'asc' } }),
      prisma.exercise.groupBy({ by: ['equipment'], where: { ...where, equipment: { not: null } }, _count: true, orderBy: { equipment: 'asc' } }),
    ])
    res.json({ data: {
      muscleGroups: grupos.map(g => ({ value: g.muscleGroup, count: g._count })),
      equipment: equipos.map(g => ({ value: g.equipment, count: g._count })),
    } })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error' }) }
}

exports.create = async (req, res) => {
  try {
    const { name, muscleGroup, equipment } = req.body
    if (!name || !muscleGroup) return res.status(400).json({ error: 'Nombre y grupo muscular requeridos' })
    res.status(201).json({ data: await prisma.exercise.create({ data: { name, muscleGroup, equipment, userId: req.user.id } }) })
  } catch { res.status(500).json({ error: 'Error' }) }
}

exports.remove = async (req, res) => {
  try { await prisma.exercise.deleteMany({ where: { id: req.params.id, userId: req.user.id } }); res.json({ message: 'Eliminado' }) }
  catch { res.status(500).json({ error: 'Error' }) }
}

exports.getHistory = async (req, res) => {
  try {
    const sets = await prisma.setLog.findMany({ where: { exerciseId: req.params.id, session: { userId: req.user.id }, isWarmup: false }, include: { session: { select: { startedAt: true } } }, orderBy: { session: { startedAt: 'desc' } }, take: 120 })
    const bySession = {}
    for (const set of sets) {
      const key = new Date(set.session.startedAt).toISOString().split('T')[0]
      if (!bySession[key]) bySession[key] = { date: set.session.startedAt, sets: [] }
      bySession[key].sets.push(set)
    }
    const sessions = Object.values(bySession).sort((a,b) => new Date(a.date)-new Date(b.date)).map(s => ({ date: s.date, maxWeight: Math.max(...s.sets.map(x=>x.weightKg)), bestE1rm: Math.max(0, ...s.sets.map(x=>epley(x.weightKg,x.reps)||0)) || null, totalVolume: s.sets.reduce((sum,x)=>sum+x.weightKg*x.reps,0), totalSets: s.sets.length, avgReps: Math.round(s.sets.reduce((sum,x)=>sum+x.reps,0)/s.sets.length) }))
    res.json({ data: sessions })
  } catch (err) { res.status(500).json({ error: 'Error' }) }
}

exports.records = async (req, res) => {
  try { res.json({ data: await userRecords(req.user.id) }) }
  catch (err) { console.error(err); res.status(500).json({ error: 'Error' }) }
}
