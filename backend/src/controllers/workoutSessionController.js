const prisma = require('../config/prisma')
const { detectPRs } = require('../services/recordService')
const inc = { routine:{ select:{ id:true, name:true, routineExercises:{ orderBy:{ order:'asc' }, select:{ exerciseId:true, targetSets:true, targetReps:true, restSeconds:true, exercise:{ select:{ id:true, name:true, muscleGroup:true, images:true } } } } } }, setLogs:{ include:{ exercise:{ select:{ id:true, name:true, muscleGroup:true, images:true } } }, orderBy:{ createdAt:'asc' } } }

exports.list = async (req,res) => { try { const { limit=20,page=1 } = req.query; const skip=(parseInt(page)-1)*parseInt(limit); const [data,total]=await Promise.all([prisma.workoutSession.findMany({ where:{ userId:req.user.id }, include:inc, orderBy:{ startedAt:'desc' }, skip, take:parseInt(limit) }),prisma.workoutSession.count({ where:{ userId:req.user.id } })]); res.json({ data, pagination:{ total, page:parseInt(page), pages:Math.ceil(total/limit) } }) } catch { res.status(500).json({ error:'Error' }) } }
exports.getOne = async (req,res) => { try { const s=await prisma.workoutSession.findFirst({ where:{ id:req.params.id, userId:req.user.id }, include:inc }); if(!s) return res.status(404).json({ error:'No encontrada' }); res.json({ data:s }) } catch { res.status(500).json({ error:'Error' }) } }

exports.start = async (req, res) => {
  try {
    const { routineId, name, bodyweightKg } = req.body
    let sessionName = name
    if (routineId && !sessionName) { const r = await prisma.routine.findFirst({ where:{ id:routineId, userId:req.user.id } }); sessionName = r?.name||'Entreno' }
    res.status(201).json({ data: await prisma.workoutSession.create({ data:{ userId:req.user.id, routineId:routineId||null, name:sessionName||'Entreno libre', bodyweightKg:bodyweightKg?parseFloat(bodyweightKg):null }, include:inc }) })
  } catch (err) { res.status(500).json({ error:err.message }) }
}

exports.addSet = async (req, res) => {
  try {
    const { exerciseId, setNumber, weightKg, reps, rpe, restSeconds, isSuperset, isWarmup, isFailure, notes } = req.body
    if (!exerciseId || weightKg===undefined || reps===undefined) return res.status(400).json({ error:'Faltan datos' })
    const ses = await prisma.workoutSession.findFirst({ where:{ id:req.params.id, userId:req.user.id }, select:{ id:true } })
    if (!ses) return res.status(404).json({ error:'Sesión no encontrada' })
    const set = await prisma.setLog.create({ data:{ sessionId:req.params.id, exerciseId, setNumber:setNumber||1, weightKg:parseFloat(weightKg), reps:parseInt(reps), rpe:rpe!==undefined?parseFloat(rpe):null, restSeconds:restSeconds?parseInt(restSeconds):null, isSuperset:isSuperset||false, isWarmup:isWarmup||false, isFailure:isFailure||false, notes }, include:{ exercise:{ select:{ name:true, muscleGroup:true } } } })
    const prs = set.isWarmup ? { types: [] } : await detectPRs({ userId: req.user.id, exerciseId, setId: set.id, weightKg: set.weightKg, reps: set.reps })
    if (prs.types?.length) require('../services/pushService').notify(req.user.id, 'gym', { title: '🏆 ¡Nuevo récord!', body: `${set.exercise?.name || 'Ejercicio'}: ${set.weightKg} kg × ${set.reps}${prs.e1rm ? ` (1RM est. ${prs.e1rm} kg)` : ''}`, url: '/fitness/records', tag: 'pr' })
    res.status(201).json({ data: { ...set, prs } })
  } catch (err) { res.status(500).json({ error:err.message }) }
}

exports.updateSet = async (req,res) => { try { const { weightKg,reps,rpe,isFailure,notes } = req.body; const own=await prisma.setLog.findFirst({ where:{ id:req.params.setId, session:{ userId:req.user.id } }, select:{ id:true } }); if (!own) return res.status(404).json({ error:'No encontrada' }); const s=await prisma.setLog.update({ where:{ id:req.params.setId }, data:{ ...(weightKg!==undefined&&{ weightKg:parseFloat(weightKg) }), ...(reps!==undefined&&{ reps:parseInt(reps) }), ...(rpe!==undefined&&{ rpe:parseFloat(rpe) }), ...(isFailure!==undefined&&{ isFailure }), ...(notes!==undefined&&{ notes }) } }); res.json({ data:s }) } catch { res.status(500).json({ error:'Error' }) } }
exports.removeSet = async (req,res) => { try { await prisma.setLog.deleteMany({ where:{ id:req.params.setId, session:{ userId:req.user.id } } }); res.json({ message:'Eliminada' }) } catch { res.status(500).json({ error:'Error' }) } }

exports.finish = async (req, res) => {
  try {
    const own = await prisma.workoutSession.findFirst({ where:{ id:req.params.id, userId:req.user.id }, select:{ id:true } }) // finish
    if (!own) return res.status(404).json({ error:'No encontrada' })
    const session = await prisma.workoutSession.update({ where:{ id:req.params.id }, data:{ finishedAt:new Date(), ...(req.body.notes&&{ notes:req.body.notes }) }, include:inc })
    const working = session.setLogs.filter(s=>!s.isWarmup)
    const summary = { totalVolume:working.reduce((s,x)=>s+x.weightKg*x.reps,0), totalSets:working.length, durationMin:session.finishedAt?Math.round((session.finishedAt-session.startedAt)/60000):null }
    res.json({ data: { ...session, summary } })
  } catch (err) { res.status(500).json({ error:err.message }) }
}

exports.remove = async (req,res) => { try { await prisma.workoutSession.deleteMany({ where:{ id:req.params.id, userId:req.user.id } }); res.json({ message:'Eliminada' }) } catch { res.status(500).json({ error:'Error' }) } }

exports.getVolumeTrend = async (req,res) => {
  try {
    const { weeks=8 } = req.query
    const since = new Date(Date.now()-parseInt(weeks)*7*24*60*60*1000)
    const sessions = await prisma.workoutSession.findMany({ where:{ userId:req.user.id, startedAt:{ gte:since }, finishedAt:{ not:null } }, include:{ setLogs:{ where:{ isWarmup:false } } } })
    const weekMap = {}
    for (const s of sessions) {
      const d = new Date(s.startedAt), monday = new Date(d)
      monday.setDate(d.getDate()-((d.getDay()+6)%7))
      const key = monday.toISOString().split('T')[0]
      if (!weekMap[key]) weekMap[key] = { week:key, volume:0, sessions:0, sets:0 }
      weekMap[key].volume += s.setLogs.reduce((sum,set)=>sum+set.weightKg*set.reps,0)
      weekMap[key].sessions++; weekMap[key].sets += s.setLogs.length
    }
    res.json({ data: Object.values(weekMap).sort((a,b)=>new Date(a.week)-new Date(b.week)) })
  } catch (err) { res.status(500).json({ error:err.message }) }
}
