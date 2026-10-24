const ACTIVITY_MULTIPLIERS = { SEDENTARY:1.2, LIGHT:1.375, MODERATE:1.55, ACTIVE:1.725, VERY_ACTIVE:1.9 }
const GOAL_ADJUSTMENTS    = { CUT:-0.20, RECOMP:0, BULK:0.12 }
const MACRO_RATIOS        = { CUT:{proteinPerKg:2.2,fatPctOfCalories:0.30}, RECOMP:{proteinPerKg:2.0,fatPctOfCalories:0.28}, BULK:{proteinPerKg:1.8,fatPctOfCalories:0.25} }

const calcAge = (birthDate) => {
  const today = new Date(), birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

const calcBMR = ({ weightKg, heightCm, age, sex }) => {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'MALE' ? base + 5 : base - 161
}

exports.calculateMacros = ({ sex, birthDate, heightCm, activityLevel, goal }, currentWeightKg) => {
  if (!heightCm || !birthDate || !currentWeightKg) throw new Error('Faltan datos del perfil')
  const age = calcAge(birthDate)
  const bmr = calcBMR({ weightKg: currentWeightKg, heightCm, age, sex })
  const tdee = bmr * (ACTIVITY_MULTIPLIERS[activityLevel] || 1.55)
  const targetCalories = tdee * (1 + (GOAL_ADJUSTMENTS[goal] ?? 0))
  const { proteinPerKg, fatPctOfCalories } = MACRO_RATIOS[goal] || MACRO_RATIOS.RECOMP
  const targetProteinG = proteinPerKg * currentWeightKg
  const fatCalories = targetCalories * fatPctOfCalories
  const targetFatG = fatCalories / 9
  const targetCarbsG = Math.max(0, (targetCalories - targetProteinG * 4 - fatCalories) / 4)
  return {
    age, bmr: Math.round(bmr), tdee: Math.round(tdee),
    targetCalories: Math.round(targetCalories),
    targetProteinG: Math.round(targetProteinG),
    targetCarbsG: Math.round(targetCarbsG),
    targetFatG: Math.round(targetFatG),
  }
}
