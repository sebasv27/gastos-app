const prisma = require('../config/prisma')
const inc = { routineExercises: { include: { exercise: true }, orderBy: { order: 'asc' } } }

exports.list    = async (req,res) => { try { res.json({ data: await prisma.routine.findMany({ where:{ userId:req.user.id }, include:inc, orderBy:{ updatedAt:'desc' } }) }) } catch { res.status(500).json({ error:'Error' }) } }
exports.getOne  = async (req,res) => { try { const r = await prisma.routine.findFirst({ where:{ id:req.params.id, userId:req.user.id }, include:inc }); if(!r) return res.status(404).json({ error:'No encontrada' }); res.json({ data:r }) } catch { res.status(500).json({ error:'Error' }) } }

exports.create = async (req, res) => {
  try {
    const { name, description, exercises=[] } = req.body
    if (!name) return res.status(400).json({ error: 'Nombre requerido' })
    const routine = await prisma.routine.create({ data: { name, description, userId: req.user.id, routineExercises: { create: exercises.map((e,i) => ({ exerciseId:e.exerciseId, order:i, targetSets:e.targetSets||3, targetReps:e.targetReps||'8-12', restSeconds:e.restSeconds||90, isSuperset:e.isSuperset||false, supersetGroup:e.supersetGroup||null, notes:e.notes })) } }, include: inc })
    res.status(201).json({ data: routine })
  } catch (err) { res.status(500).json({ error: err.message }) }
}

exports.update = async (req, res) => {
  try {
    const { name, description, exercises, isActive } = req.body
    if (exercises) await prisma.routineExercise.deleteMany({ where: { routineId: req.params.id } })
    const r = await prisma.routine.update({ where: { id: req.params.id }, data: { ...(name!==undefined&&{name}), ...(description!==undefined&&{description}), ...(isActive!==undefined&&{isActive}), ...(exercises&&{ routineExercises:{ create:exercises.map((e,i)=>({ exerciseId:e.exerciseId, order:i, targetSets:e.targetSets||3, targetReps:e.targetReps||'8-12', restSeconds:e.restSeconds||90, isSuperset:e.isSuperset||false, supersetGroup:e.supersetGroup||null, notes:e.notes })) } }) }, include: inc })
    res.json({ data: r })
  } catch (err) { res.status(500).json({ error: err.message }) }
}

exports.remove = async (req,res) => { try { await prisma.routine.deleteMany({ where:{ id:req.params.id, userId:req.user.id } }); res.json({ message:'Eliminada' }) } catch { res.status(500).json({ error:'Error' }) } }

exports.duplicate = async (req, res) => {
  try {
    const original = await prisma.routine.findFirst({ where:{ id:req.params.id, userId:req.user.id }, include:inc })
    if (!original) return res.status(404).json({ error: 'No encontrada' })
    const copy = await prisma.routine.create({ data: { name:`${original.name} (copia)`, description:original.description, userId:req.user.id, routineExercises:{ create:original.routineExercises.map(re=>({ exerciseId:re.exerciseId, order:re.order, targetSets:re.targetSets, targetReps:re.targetReps, restSeconds:re.restSeconds, isSuperset:re.isSuperset, supersetGroup:re.supersetGroup, notes:re.notes })) } }, include:inc })
    res.status(201).json({ data: copy })
  } catch { res.status(500).json({ error:'Error' }) }
}
