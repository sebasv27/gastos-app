// src/types/index.ts

export interface User {
  id: string
  name: string
  email: string
  monthlyIncome: number
}

export interface Category {
  id: string
  name: string
  icon: string
  color: string
}

export interface Transaction {
  id: string
  amount: number
  description: string
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER'
  source: 'MANUAL' | 'NOTIFICATION' | 'RECEIPT_OCR' | 'IMPORT'
  date: string
  notes?: string
  categoryId?: string
  category?: Category
}

export interface Budget {
  id: string
  amount: number
  spent: number
  month: number
  year: number
  alertAt: number
  categoryId: string
  category: Category
}

export interface Goal {
  id: string
  name: string
  targetAmount: number
  savedAmount: number
  deadline?: string
  icon: string
  color: string
  status: 'ACTIVE' | 'COMPLETED' | 'PAUSED'
}

export interface Alert {
  id: string
  type: 'BUDGET_WARNING' | 'BUDGET_EXCEEDED' | 'GOAL_REACHED' | 'WEEKLY_SUMMARY' | 'UNUSUAL_EXPENSE'
  message: string
  isRead: boolean
  createdAt: string
  metadata?: Record<string, unknown>
}

export interface DashboardSummary {
  totalExpenses: number
  totalIncome: number
  balance: number
  transactionCount: number
  savingsRate: string
}

export interface DashboardData {
  month: number
  year: number
  summary: DashboardSummary
  byCategoryFull: { category: Category; total: number; pct: string }[]
  dailyExpenses:  { day: string; total: number }[]
  budgets: Budget[]
  recent: Transaction[]
  goals: Goal[]
  unreadAlerts: number
}

// ════════════════════════════════════════════════════════════════════════
// FITNESS MODULE
// ════════════════════════════════════════════════════════════════════════

export type Sex = 'MALE' | 'FEMALE'
export type ActivityLevel = 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE'
export type FitnessGoal = 'CUT' | 'RECOMP' | 'BULK'
export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK' | 'OTHER'
export type MealSource = 'MANUAL' | 'PHOTO_OCR' | 'IMPORT'

export interface FitnessProfile {
  id: string
  sex: Sex
  birthDate?: string
  heightCm?: number
  activityLevel: ActivityLevel
  goal: FitnessGoal
  tdee?: number
  targetCalories?: number
  targetProteinG?: number
  targetCarbsG?: number
  targetFatG?: number
}

export interface BodyLog {
  id: string
  weightKg: number
  bodyFatPct?: number
  notes?: string
  date: string
}

export interface BodyProgress {
  logs: BodyLog[]
  trend: { date: string; weightKg: number; trendKg: number }[]
  delta: { kg: number; days: number } | null
}

export interface Exercise {
  id: string
  name: string
  muscleGroup: string
  equipment?: string
  isDefault: boolean
}

export interface ExerciseHistoryPoint {
  date: string
  maxWeight: number
  totalVolume: number
  totalSets: number
  avgReps: number
}

export interface RoutineExercise {
  id: string
  exerciseId: string
  exercise: Exercise
  order: number
  targetSets: number
  targetReps: string
  restSeconds: number
  isSuperset: boolean
  supersetGroup?: number
  notes?: string
}

export interface Routine {
  id: string
  name: string
  description?: string
  isActive: boolean
  routineExercises: RoutineExercise[]
  updatedAt: string
}

export interface SetLog {
  id: string
  exerciseId: string
  exercise: { name: string; muscleGroup: string }
  setNumber: number
  weightKg: number
  reps: number
  rpe?: number
  restSeconds?: number
  isSuperset: boolean
  isWarmup: boolean
  isFailure: boolean
  notes?: string
}

export interface WorkoutSession {
  id: string
  name: string
  routineId?: string
  routine?: { id: string; name: string }
  startedAt: string
  finishedAt?: string
  notes?: string
  bodyweightKg?: number
  setLogs: SetLog[]
}

export interface VolumeWeek {
  week: string
  volume: number
  sessions: number
  sets: number
}

export interface Meal {
  id: string
  name: string
  mealType: MealType
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  source: MealSource
  date: string
}

export interface MealTargets {
  calories?: number
  proteinG?: number
  carbsG?: number
  fatG?: number
}

export interface TodayMealsSummary {
  meals: Meal[]
  totals: { calories: number; proteinG: number; carbsG: number; fatG: number }
  targets: MealTargets | null
}

// ── Meal Recommendations ─────────────────────────────────────────────────

export interface RecipeIngredient {
  name: string
  amount: string
  proteinG: number
  notes?: string
}

export interface RecipeStep {
  step: number
  text: string
  minutes: number
}

export interface Recipe {
  id: string
  name: string
  mealType: MealType
  emoji: string
  style: string
  difficulty: 1 | 2 | 3
  prepMinutes: number
  cookMinutes: number
  servings: number
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  whyRecommended: string
  ingredients: RecipeIngredient[]
  steps: RecipeStep[]
  tips: string[]
  searchQuery: string
  tags: string[]
}

export interface MealRecommendationResult {
  mode: string
  summary: string
  recipes: Recipe[]
  consumed: { calories: number; proteinG: number; carbsG: number; fatG: number }
  targets: MealTargets | null
}
