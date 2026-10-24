const prisma = require('../config/prisma')
const DEFAULT_EXERCISES = [
  { name:'Press de banca', muscleGroup:'Pecho', equipment:'Barra' },
  { name:'Press inclinado mancuerna', muscleGroup:'Pecho', equipment:'Mancuerna' },
  { name:'Fondos en paralelas', muscleGroup:'Pecho', equipment:'Peso corporal' },
  { name:'Dominadas', muscleGroup:'Espalda', equipment:'Peso corporal' },
  { name:'Remo con barra', muscleGroup:'Espalda', equipment:'Barra' },
  { name:'Jalón al pecho', muscleGroup:'Espalda', equipment:'Máquina' },
  { name:'Peso muerto', muscleGroup:'Espalda', equipment:'Barra' },
  { name:'Sentadilla', muscleGroup:'Pierna', equipment:'Barra' },
  { name:'Prensa', muscleGroup:'Pierna', equipment:'Máquina' },
  { name:'Zancadas', muscleGroup:'Pierna', equipment:'Mancuerna' },
  { name:'Extensión de cuádriceps', muscleGroup:'Pierna', equipment:'Máquina' },
  { name:'Curl femoral', muscleGroup:'Pierna', equipment:'Máquina' },
  { name:'Elevación de talones', muscleGroup:'Pierna', equipment:'Máquina' },
  { name:'Press militar', muscleGroup:'Hombro', equipment:'Barra' },
  { name:'Elevaciones laterales', muscleGroup:'Hombro', equipment:'Mancuerna' },
  { name:'Face pull', muscleGroup:'Hombro', equipment:'Cable' },
  { name:'Curl de bíceps', muscleGroup:'Brazo', equipment:'Mancuerna' },
  { name:'Curl martillo', muscleGroup:'Brazo', equipment:'Mancuerna' },
  { name:'Press francés', muscleGroup:'Brazo', equipment:'Barra' },
  { name:'Extensión de tríceps en polea', muscleGroup:'Brazo', equipment:'Cable' },
  { name:'Plancha', muscleGroup:'Core', equipment:'Peso corporal' },
  { name:'Crunch en polea', muscleGroup:'Core', equipment:'Cable' },
  { name:'Elevación de piernas', muscleGroup:'Core', equipment:'Peso corporal' },
  { name:'Caminadora', muscleGroup:'Cardio', equipment:'Máquina' },
  { name:'Bicicleta estática', muscleGroup:'Cardio', equipment:'Máquina' },
  { name:'Remo en polea baja', muscleGroup:'Espalda', equipment:'Cable' },
]
exports.seedDefaultExercises = async () => {
  await prisma.exercise.createMany({ data: DEFAULT_EXERCISES.map(e => ({ ...e, isDefault: true })), skipDuplicates: true })
}
