// src/pages/WorkoutSessionPage.tsx
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Plus, Timer, Flame, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { workoutSessionApi, exerciseApi } from '../services/api'
import { WorkoutSession, Exercise, SetLog } from '../types'
import ExercisePicker from '../components/exercises/ExercisePicker'
import ExerciseThumb, { exerciseImageUrl } from '../components/exercises/ExerciseThumb'

const RPE_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]

function RestTimer({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [remaining, setRemaining] = useState(seconds)
  useEffect(() => {
    if (remaining <= 0) { onDone(); return }
    const t = setTimeout(() => setRemaining(r => r - 1), 1000)
    return () => clearTimeout(t)
  }, [remaining, onDone])

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const pct  = (remaining / seconds) * 100

  return (
    <div className="bg-dark text-white rounded-xl p-4 flex items-center gap-4">
      <div className="relative w-12 h-12 shrink-0">
        <svg className="w-12 h-12 -rotate-90">
          <circle cx="24" cy="24" r="20" stroke="#334155" strokeWidth="4" fill="none" />
          <circle cx="24" cy="24" r="20" stroke="#0F6E56" strokeWidth="4" fill="none"
            strokeDasharray={125.6} strokeDashoffset={125.6 * (1 - pct / 100)}
            strokeLinecap="round" className="transition-all duration-1000" />
        </svg>
        <Timer size={16} className="absolute inset-0 m-auto text-brand-400" />
      </div>
      <div className="flex-1">
        <p className="text-xs text-slate-400">Descansando</p>
        <p className="text-xl font-bold tabular-nums">{mins}:{secs.toString().padStart(2, '0')}</p>
      </div>
      <button onClick={() => setRemaining(0)} className="text-xs text-slate-400 hover:text-white px-3 py-1.5 border border-slate-600 rounded-lg">
        Saltar
      </button>
    </div>
  )
}

export default function WorkoutSessionPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [activeRest, setActiveRest] = useState<{ exerciseId: string; seconds: number } | null>(null)
  const [expandedExercise, setExpanded] = useState<string | null>(null)
  const [addExercisePicker, setAddExercisePicker] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [extraIds, setExtraIds] = useState<string[]>([])
  const formRefs = useRef<Record<string, { weight: string; reps: string; rpe: number | null }>>({})

  const { data: session, refetch } = useQuery({
    queryKey: ['workout-session', id],
    queryFn: () => workoutSessionApi.getOne(id!).then(r => r.data.data as WorkoutSession),
    enabled: !!id,
    refetchInterval: 5000,
  })

  const { data: exercisesData } = useQuery({
    queryKey: ['exercises'],
    queryFn: () => exerciseApi.list().then(r => r.data.data as Exercise[])
  })
  const allExercises = exercisesData || []

  if (!session) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // Agrupar sets por ejercicio en orden de aparición
  const exerciseOrder: string[] = []
  const routineItems = (((session as any).routine?.routineExercises) ?? []) as {
    exerciseId: string; restSeconds?: number | null; targetSets?: number; targetReps?: string
    exercise?: { id: string; name: string; muscleGroup: string; images?: string[] }
  }[]
  const setsByExercise: Record<string, SetLog[]> = {}
  const pushExercise = (exId: string) => {
    if (!setsByExercise[exId]) { setsByExercise[exId] = []; exerciseOrder.push(exId) }
  }
  routineItems.forEach(re => pushExercise(re.exerciseId))
  extraIds.forEach(pushExercise)
  for (const s of session.setLogs) {
    if (!setsByExercise[s.exerciseId]) {
      setsByExercise[s.exerciseId] = []
      exerciseOrder.push(s.exerciseId)
    }
    setsByExercise[s.exerciseId].push(s)
  }

  const getForm = (exerciseId: string) => {
    if (!formRefs.current[exerciseId]) {
      formRefs.current[exerciseId] = { weight: '', reps: '', rpe: null }
    }
    return formRefs.current[exerciseId]
  }

  const addExerciseToSession = (ex: Exercise) => {
    setExtraIds(ids => ids.includes(ex.id) ? ids : [...ids, ex.id])
    setExpanded(ex.id)
    setAddExercisePicker(false)
  }

  const logSet = async (exerciseId: string) => {
    const form = getForm(exerciseId)
    if (!form.weight || !form.reps) { toast.error('Ingresa peso y repeticiones'); return }

    const setNumber = (setsByExercise[exerciseId]?.length || 0) + 1
    try {
      await workoutSessionApi.addSet(id!, {
        exerciseId,
        setNumber,
        weightKg: parseFloat(form.weight),
        reps: parseInt(form.reps),
        rpe: form.rpe,
      })
      formRefs.current[exerciseId] = { weight: form.weight, reps: form.reps, rpe: null } // mantiene peso para siguiente serie
      refetch()
      qc.invalidateQueries({ queryKey: ['volume-trend'] })

      // Buscar descanso objetivo de la rutina si existe
      const routineRest = session.routine
        ? (routineItems.find(r => r.exerciseId === exerciseId)?.restSeconds ?? 90)
        : 90
      setActiveRest({ exerciseId, seconds: routineRest })
    } catch {
      toast.error('Error al registrar serie')
    }
  }

  const removeSet = async (exerciseId: string, setId: string) => {
    try {
      await workoutSessionApi.removeSet(id!, setId)
      refetch()
    } catch { toast.error('Error al eliminar serie') }
  }

  const finishWorkout = async () => {
    setFinishing(true)
    try {
      const res = await workoutSessionApi.finish(id!)
      const summary = res.data.data.summary
      toast.success(`¡Entreno terminado! ${summary.totalSets} series · ${Math.round(summary.totalVolume).toLocaleString()} kg de volumen`)
      navigate('/progreso')
    } catch {
      toast.error('Error al finalizar')
      setFinishing(false)
    }
  }

  const totalSets   = session.setLogs.filter(s => !s.isWarmup).length
  const totalVolume = session.setLogs.filter(s => !s.isWarmup).reduce((s, x) => s + x.weightKg * x.reps, 0)
  const elapsedMin  = Math.round((Date.now() - new Date(session.startedAt).getTime()) / 60000)

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-24">
      {/* Header */}
      <div className="bg-dark text-white rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">{session.routine ? 'Desde rutina' : 'Entreno libre'}</p>
            <h1 className="text-lg font-bold">{session.name}</h1>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Duración</p>
            <p className="text-lg font-bold tabular-nums">{elapsedMin} min</p>
          </div>
        </div>
        <div className="flex gap-4 mt-3 pt-3 border-t border-slate-700">
          <div>
            <p className="text-xs text-slate-400">Series</p>
            <p className="text-sm font-semibold">{totalSets}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Volumen</p>
            <p className="text-sm font-semibold">{Math.round(totalVolume).toLocaleString()} kg</p>
          </div>
        </div>
      </div>

      {/* Active rest timer */}
      {activeRest && (
        <RestTimer seconds={activeRest.seconds} onDone={() => setActiveRest(null)} />
      )}

      {/* Exercises */}
      {exerciseOrder.map(exId => {
        const ex   = allExercises.find(e => e.id === exId) ?? (routineItems.find(r => r.exerciseId === exId)?.exercise as any)
        const sets = setsByExercise[exId] || []
        const isOpen = expandedExercise === exId || sets.length === 0
        const form = getForm(exId)

        return (
          <div key={exId} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button onClick={() => setExpanded(isOpen ? null : exId)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50">
              <div className="flex items-center gap-2">
                <ExerciseThumb src={exerciseImageUrl(ex as any)} size="w-8 h-8" />
                <span className="text-sm font-semibold text-dark">{ex?.name || 'Ejercicio'}</span>
                <span className="text-xs text-slate-400">{sets.length} series</span>
              </div>
              {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </button>

            {isOpen && (
              <div className="px-4 pb-4 space-y-3">
                {/* Logged sets */}
                {sets.length > 0 && (
                  <div className="space-y-1.5">
                    {sets.map(s => (
                      <div key={s.id} className="flex items-center gap-2 text-sm bg-slate-50 rounded-lg px-3 py-2">
                        <span className="w-6 text-xs font-bold text-slate-400">#{s.setNumber}</span>
                        <span className="flex-1 font-medium text-dark">{s.weightKg}kg × {s.reps}</span>
                        {s.rpe && (
                          <span className="flex items-center gap-0.5 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                            <Flame size={10} />RPE {s.rpe}
                          </span>
                        )}
                        {s.isFailure && (
                          <span className="text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">Al fallo</span>
                        )}
                        <button onClick={() => removeSet(exId, s.id)} className="text-slate-300 hover:text-red-500">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add set form */}
                <div className="flex items-center gap-2">
                  <input type="number" placeholder="kg" defaultValue={form.weight}
                    onChange={e => { getForm(exId).weight = e.target.value }}
                    className="w-16 border border-slate-200 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  <span className="text-slate-300">×</span>
                  <input type="number" placeholder="reps" defaultValue={form.reps}
                    onChange={e => { getForm(exId).reps = e.target.value }}
                    className="w-16 border border-slate-200 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  <select defaultValue=""
                    onChange={e => { getForm(exId).rpe = e.target.value ? parseFloat(e.target.value) : null }}
                    className="flex-1 border border-slate-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500">
                    <option value="">RPE (opcional)</option>
                    {RPE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <button onClick={() => logSet(exId)}
                    className="bg-brand-600 text-white rounded-lg p-2 hover:bg-brand-700 shrink-0">
                    <Check size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Add exercise button */}
      <button onClick={() => setAddExercisePicker(true)}
        className="w-full border-2 border-dashed border-slate-200 hover:border-brand-300 rounded-xl py-3 text-sm text-slate-500 hover:text-brand-600 transition-colors flex items-center justify-center gap-1.5">
        <Plus size={14} />Agregar ejercicio
      </button>

      {/* Exercise picker */}
      <ExercisePicker
        open={addExercisePicker}
        onClose={() => setAddExercisePicker(false)}
        onSelect={ex => addExerciseToSession(ex as unknown as Exercise)}
        excludeIds={exerciseOrder}
      />

      {/* Fixed finish button */}
      <div className="fixed bottom-0 left-0 right-0 md:left-56 bg-white border-t border-slate-200 p-4">
        <div className="max-w-2xl mx-auto">
          <button onClick={finishWorkout} disabled={finishing || totalSets === 0}
            className="w-full bg-brand-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-brand-700 disabled:opacity-40 transition-colors">
            {finishing ? 'Finalizando...' : `Terminar entreno (${totalSets} series)`}
          </button>
        </div>
      </div>
    </div>
  )
}
