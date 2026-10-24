// Fusiona los ejercicios originales (duplicados y sin foto) con su equivalente
// del catálogo free-exercise-db, conservando series y rutinas.
//
// Uso:
//   node scripts/mergeExercises.js            -> solo muestra el plan (no cambia nada)
//   node scripts/mergeExercises.js --aplicar  -> ejecuta la fusión
const { execSync } = require('child_process')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const APLICAR = process.argv.includes('--aplicar')

// Nombre original -> posibles nombres en inglés en el catálogo (en orden de preferencia)
const MAPA = {
  'Bicicleta estática': ['Bicycling, Stationary', 'Recumbent Bike'],
  'Caminadora': ['Jogging, Treadmill', 'Walking, Treadmill', 'Running, Treadmill'],
  'Crunch en polea': ['Cable Crunch', 'Kneeling Cable Crunch With Alternating Oblique Twists'],
  'Curl de bíceps': ['Barbell Curl', 'Dumbbell Bicep Curl'],
  'Curl femoral': ['Lying Leg Curls', 'Seated Leg Curl'],
  'Curl martillo': ['Hammer Curls', 'Alternate Hammer Curl'],
  'Dominadas': ['Pullups', 'Wide-Grip Rear Pull-Up'],
  'Elevación de piernas': ['Hanging Leg Raise', 'Flat Bench Lying Leg Raise'],
  'Elevación de talones': ['Standing Calf Raises', 'Calf Raise On A Dumbbell', 'Standing Barbell Calf Raise'],
  'Elevaciones laterales': ['Side Lateral Raise', 'Dumbbell Lateral Raise'],
  'Extensión de cuádriceps': ['Leg Extensions'],
  'Extensión de tríceps en polea': ['Triceps Pushdown', 'Triceps Pushdown - Rope Attachment'],
  'Face pull': ['Face Pull'],
  'Fondos en paralelas': ['Dips - Triceps Version', 'Dips - Chest Version'],
  'Jalón al pecho': ['Wide-Grip Lat Pulldown', 'Close-Grip Front Lat Pulldown'],
  'Peso muerto': ['Barbell Deadlift'],
  'Plancha': ['Plank'],
  'Prensa': ['Leg Press'],
  'Press de banca': ['Barbell Bench Press - Medium Grip', 'Barbell Bench Press'],
  'Press francés': ['EZ-Bar Skullcrusher', 'Lying Triceps Press'],
  'Press inclinado mancuerna': ['Incline Dumbbell Press'],
  'Press militar': ['Standing Military Press', 'Barbell Shoulder Press'],
  'Remo con barra': ['Bent Over Barbell Row'],
  'Remo en polea baja': ['Seated Cable Rows'],
  'Sentadilla': ['Barbell Squat', 'Barbell Full Squat'],
  'Zancadas': ['Dumbbell Lunges', 'Barbell Lunge'],
}

function traduccionCorriendo() {
  // [t] evita que pgrep se encuentre a sí mismo
  try { execSync("pgrep -f '[t]ranslateExercises'"); return true } catch { return false }
}

async function main() {
  if (APLICAR && traduccionCorriendo()) {
    console.error('❌ La traducción sigue corriendo. Espera a que termine (tail ~/translate.log) y vuelve a intentar.')
    process.exitCode = 1
    return
  }

  console.log(APLICAR ? '🚀 APLICANDO cambios\n' : '👀 Modo plan (no se cambia nada). Usa --aplicar para ejecutar.\n')

  const originales = await prisma.exercise.findMany({
    where: { externalId: null, userId: null },
    select: { id: true, name: true, _count: { select: { setLogs: true, routineExercises: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const porNombre = {}
  for (const o of originales) (porNombre[o.name] ||= []).push(o)

  let fusionados = 0, soloDuplicados = 0, eliminados = 0
  const sinTraducir = []

  for (const [nombre, grupo] of Object.entries(porNombre)) {
    let destino = null
    for (const c of MAPA[nombre] || []) {
      destino = await prisma.exercise.findFirst({
        where: { externalId: { not: null }, nameEn: { equals: c, mode: 'insensitive' } },
        select: { id: true, nameEn: true, instructions: true },
      })
      if (destino) break
    }

    const refs = grupo.reduce((n, o) => n + o._count.setLogs + o._count.routineExercises, 0)
    let keepId, borrar

    if (destino) {
      keepId = destino.id
      borrar = grupo.map(o => o.id)
      fusionados++
      console.log(`🔗 ${nombre.padEnd(30)} → ${destino.nameEn}  (${grupo.length} originales, ${refs} refs)`)
      if (!destino.instructions?.length) sinTraducir.push(nombre)
    } else {
      keepId = grupo[0].id
      borrar = grupo.slice(1).map(o => o.id)
      soloDuplicados++
      console.log(`⚠️  ${nombre.padEnd(30)}   sin equivalente en catálogo: se deja 1 y se borran ${borrar.length} duplicado(s)`)
    }
    eliminados += borrar.length

    if (!APLICAR || borrar.length === 0) continue

    await prisma.$transaction([
      prisma.setLog.updateMany({ where: { exerciseId: { in: borrar } }, data: { exerciseId: keepId } }),
      prisma.routineExercise.updateMany({ where: { exerciseId: { in: borrar } }, data: { exerciseId: keepId } }),
      prisma.exercise.deleteMany({ where: { id: { in: borrar } } }),
      ...(destino ? [prisma.exercise.update({ where: { id: destino.id }, data: { name: nombre } })] : []),
    ])
  }

  console.log(`\n${APLICAR ? '✅ Hecho' : '📋 Plan'}: ${fusionados} fusionados con el catálogo | ${soloDuplicados} solo sin duplicar | ${eliminados} registros ${APLICAR ? 'eliminados' : 'a eliminar'}`)
  if (sinTraducir.length) {
    console.log(`⚠️  Estos destinos aún no tienen instrucciones en español: ${sinTraducir.join(', ')}`)
    console.log('   Si vuelves a correr la traducción, revisa que no les cambie el nombre.')
  }
}

main()
  .catch(e => { console.error('❌', e.message); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
