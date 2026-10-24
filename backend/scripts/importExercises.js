// Importa free-exercise-db (dominio público, Unlicense) a la tabla exercises.
// Uso: node scripts/importExercises.js [--sin-estiramientos]
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json'
const SIN_ESTIRAMIENTOS = process.argv.includes('--sin-estiramientos')

// Músculo principal -> tus grupos actuales
const GRUPO = {
  abdominals: 'Core',
  chest: 'Pecho',
  shoulders: 'Hombro', neck: 'Hombro',
  biceps: 'Brazo', triceps: 'Brazo', forearms: 'Brazo',
  lats: 'Espalda', 'middle back': 'Espalda', 'lower back': 'Espalda', traps: 'Espalda',
  quadriceps: 'Pierna', hamstrings: 'Pierna', glutes: 'Pierna', calves: 'Pierna',
  adductors: 'Pierna', abductors: 'Pierna',
}

// Equipo -> tus nombres actuales (+ nuevos en español)
const EQUIPO = {
  'body only': 'Peso corporal',
  dumbbell: 'Mancuerna',
  cable: 'Cable',
  machine: 'Máquina',
  barbell: 'Barra',
  'e-z curl bar': 'Barra Z',
  kettlebells: 'Kettlebell',
  bands: 'Bandas',
  'medicine ball': 'Balón medicinal',
  'exercise ball': 'Fitball',
  'foam roll': 'Rodillo',
  other: 'Otro',
}

const grupoDe = ex =>
  ex.category === 'cardio' ? 'Cardio' : (GRUPO[ex.primaryMuscles?.[0]] || 'Core')

async function main() {
  console.log('⬇️  Descargando dataset...')
  const res = await fetch(URL)
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar el dataset`)
  const data = await res.json()
  console.log(`📦 ${data.length} ejercicios en el dataset`)

  let creados = 0, actualizados = 0, omitidos = 0

  for (const ex of data) {
    if (SIN_ESTIRAMIENTOS && ex.category === 'stretching') { omitidos++; continue }

    // Campos que siempre se pueden refrescar desde el dataset
    const meta = {
      nameEn: ex.name,
      muscleGroup: grupoDe(ex),
      equipment: ex.equipment ? (EQUIPO[ex.equipment] || ex.equipment) : null,
      category: ex.category || null,
      level: ex.level || null,
      force: ex.force || null,
      mechanic: ex.mechanic || null,
      primaryMuscles: ex.primaryMuscles || [],
      secondaryMuscles: ex.secondaryMuscles || [],
      instructionsEn: ex.instructions || [],
      images: ex.images || [],
      isDefault: true,
    }

    const existe = await prisma.exercise.findUnique({
      where: { externalId: ex.id }, select: { id: true },
    })

    if (existe) {
      // No toca name ni instructions para no pisar las traducciones
      await prisma.exercise.update({ where: { id: existe.id }, data: meta })
      actualizados++
    } else {
      await prisma.exercise.create({
        data: { ...meta, externalId: ex.id, name: ex.name, instructions: [], userId: null },
      })
      creados++
    }
    if ((creados + actualizados) % 100 === 0) process.stdout.write('.')
  }

  console.log(`\n✅ Creados: ${creados} | Actualizados: ${actualizados} | Omitidos: ${omitidos}`)
}

main()
  .catch(e => { console.error('❌', e.message); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
