// src/pages/RoutinesPage.tsx
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Dumbbell, Copy, Trash2, Play, Pencil, X, GripVertical, Link2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { routineApi, exerciseApi, workoutSessionApi } from '../services/api'
import { Routine, Exercise } from '../types'
import ExercisePicker from '../components/exercises/ExercisePicker'
import ExerciseThumb, { exerciseImageUrl } from '../components/exercises/ExerciseThumb'

interface DraftExercise {
  image?: string | null
  exerciseId: string
  name: string
  targetSets: number
  targetReps: string
  restSeconds: number
  isSuperset: boolean
  supersetGroup?: number
}

export default function RoutinesPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [showBuilder, setShowBuilder] = useState(false)
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [draft, setDraft]             = useState<DraftExercise[]>([])
  const [exercisePicker, setExercisePicker] = useState(false)
  const [saving, setSaving]           = useState(false)

  const { data: routinesData, isLoading } = useQuery({
    queryKey: ['routines'],
    queryFn: () => routineApi.list().then(r => r.data.data as Routine[])
  })
  const routines = routinesData || []

  const { data: exercisesData } = useQuery({
    queryKey: ['exercises'],
    queryFn: () => exerciseApi.list().then(r => r.data.data as Exercise[])
  })
  const exercises = exercisesData || []

  const resetBuilder = () => {
    setName(''); setDescription(''); setDraft([])
    setEditingId(null); setShowBuilder(false)
  }

  const openEdit = (r: Routine) => {
    setEditingId(r.id)
    setName(r.name)
    setDescription(r.description || '')
    setDraft(r.routineExercises.map(re => ({
      exerciseId: re.exerciseId,
      name: re.exercise.name,
      image: exerciseImageUrl(re.exercise as any),
      targetSets: re.targetSets,
      targetReps: re.targetReps,
      restSeconds: re.restSeconds,
      isSuperset: re.isSuperset,
      supersetGroup: re.supersetGroup,
    })))
    setShowBuilder(true)
  }

  const addExercise = (ex: Exercise) => {
    setDraft(d => [...d, {
      exerciseId: ex.id, name: ex.name, image: exerciseImageUrl(ex as any),
      targetSets: 3, targetReps: '8-12', restSeconds: 90, isSuperset: false
    }])
    setExercisePicker(false)
  }

  const updateDraft = (i: number, patch: Partial<DraftExercise>) =>
    setDraft(d => d.map((x, idx) => idx === i ? { ...x, ...patch } : x))

  const removeDraft = (i: number) =>
    setDraft(d => d.filter((_, idx) => idx !== i))

  const toggleSuperset = (i: number) => {
    // Vincula el ejercicio actual con el anterior en una superserie
    if (i === 0) return
    setDraft(d => {
      const group = d[i - 1].supersetGroup ?? Date.now()
      return d.map((x, idx) => {
        if (idx === i - 1 || idx === i) return { ...x, isSuperset: true, supersetGroup: group }
        return x
      })
    })
  }

  const save = async () => {
    if (!name.trim()) { toast.error('Ponle un nombre a la rutina'); return }
    if (draft.length === 0) { toast.error('Agrega al menos un ejercicio'); return }

    setSaving(true)
    try {
      const payload = { name, description, exercises: draft }
      if (editingId) {
        await routineApi.update(editingId, payload)
        toast.success('Rutina actualizada')
      } else {
        await routineApi.create(payload)
        toast.success('Rutina creada')
      }
      qc.invalidateQueries({ queryKey: ['routines'] })
      resetBuilder()
    } catch {
      toast.error('Error al guardar rutina')
    } finally {
      setSaving(false)
    }
  }

  const duplicate = async (id: string) => {
    try {
      await routineApi.duplicate(id)
      toast.success('Rutina duplicada')
      qc.invalidateQueries({ queryKey: ['routines'] })
    } catch { toast.error('Error al duplicar') }
  }

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar esta rutina?')) return
    try {
      await routineApi.remove(id)
      toast.success('Eliminada')
      qc.invalidateQueries({ queryKey: ['routines'] })
    } catch { toast.error('Error al eliminar') }
  }

  const startWorkout = async (routine: Routine) => {
    try {
      const res = await workoutSessionApi.start({ routineId: routine.id, name: routine.name })
      navigate(`/entreno/${res.data.data.id}`)
    } catch { toast.error('Error al iniciar entreno') }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-dark">Rutinas</h1>
          <p className="text-slate-500 text-sm mt-0.5">Plantillas reutilizables — arma una vez, entrena siempre</p>
        </div>
        {!showBuilder && (
          <button onClick={() => setShowBuilder(true)}
            className="flex items-center gap-1.5 bg-brand-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-brand-700">
            <Plus size={14} />Nueva rutina
          </button>
        )}
      </div>

      {/* Builder */}
      {showBuilder && (
        <div className="bg-white rounded-xl border border-brand-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-dark">{editingId ? 'Editar rutina' : 'Nueva rutina'}</h2>
            <button onClick={resetBuilder} className="p-1 hover:bg-slate-100 rounded-lg">
              <X size={16} />
            </button>
          </div>

          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Nombre de la rutina (ej. Día de pierna)"
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500" />

          <input value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Descripción opcional"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />

          {/* Exercise list */}
          <div className="space-y-2">
            {draft.map((ex, i) => (
              <div key={i}>
                {ex.isSuperset && i > 0 && draft[i - 1].supersetGroup === ex.supersetGroup && (
                  <div className="flex items-center gap-1.5 text-xs text-violet-600 font-medium ml-2 mb-1">
                    <Link2 size={11} />Superserie
                  </div>
                )}
                <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-3">
                  <GripVertical size={14} className="text-slate-300 shrink-0" />
                  <ExerciseThumb src={ex.image} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-dark truncate">{ex.name}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <input type="number" value={ex.targetSets}
                        onChange={e => updateDraft(i, { targetSets: parseInt(e.target.value) || 1 })}
                        className="w-12 text-xs border border-slate-200 rounded px-1.5 py-1 text-center" />
                      <span className="text-xs text-slate-400">series</span>
                      <input value={ex.targetReps}
                        onChange={e => updateDraft(i, { targetReps: e.target.value })}
                        className="w-16 text-xs border border-slate-200 rounded px-1.5 py-1 text-center" />
                      <span className="text-xs text-slate-400">reps</span>
                      <input type="number" value={ex.restSeconds}
                        onChange={e => updateDraft(i, { restSeconds: parseInt(e.target.value) || 0 })}
                        className="w-14 text-xs border border-slate-200 rounded px-1.5 py-1 text-center" />
                      <span className="text-xs text-slate-400">seg desc.</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {i > 0 && (
                      <button onClick={() => toggleSuperset(i)}
                        className="text-xs text-violet-500 hover:bg-violet-50 px-1.5 py-0.5 rounded">
                        <Link2 size={12} />
                      </button>
                    )}
                    <button onClick={() => removeDraft(i)}
                      className="text-slate-300 hover:text-red-500">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => setExercisePicker(true)}
            className="w-full border-2 border-dashed border-slate-200 hover:border-brand-300 rounded-lg py-2.5 text-sm text-slate-500 hover:text-brand-600 transition-colors">
            + Agregar ejercicio
          </button>

          <button onClick={save} disabled={saving}
            className="w-full bg-brand-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
            {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear rutina'}
          </button>
        </div>
      )}

      {/* Exercise picker modal */}
      <ExercisePicker
        open={exercisePicker}
        onClose={() => setExercisePicker(false)}
        onSelect={ex => addExercise(ex as unknown as Exercise)}
        excludeIds={draft.map((d: any) => d.exerciseId ?? d.exercise?.id).filter(Boolean)}
      />

      {/* Routine list */}
      {isLoading ? (
        <div className="py-16 text-center">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : routines.length === 0 && !showBuilder ? (
        <div className="py-16 text-center">
          <Dumbbell size={32} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Sin rutinas todavía</p>
          <button onClick={() => setShowBuilder(true)} className="text-brand-600 text-sm font-medium mt-2 hover:underline">
            Crear tu primera rutina →
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {routines.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-dark truncate">{r.name}</p>
                  {r.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{r.description}</p>}
                </div>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                {r.routineExercises.length} ejercicios
              </p>
              <div className="flex flex-wrap gap-1 mb-3">
                {r.routineExercises.slice(0, 4).map(re => (
                  <span key={re.id} className="text-xs bg-slate-100 text-slate-600 pl-1 pr-2 py-0.5 rounded-full inline-flex items-center gap-1.5">
                    {exerciseImageUrl(re.exercise as any) && <img src={exerciseImageUrl(re.exercise as any)!} alt="" className="w-5 h-5 rounded-full object-cover" />}
                    {re.exercise.name}
                  </span>
                ))}
                {r.routineExercises.length > 4 && (
                  <span className="text-xs text-slate-400 px-1">+{r.routineExercises.length - 4}</span>
                )}
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => startWorkout(r)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-brand-600 text-white rounded-lg py-2 text-xs font-medium hover:bg-brand-700">
                  <Play size={12} />Empezar
                </button>
                <button onClick={() => openEdit(r)}
                  className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500">
                  <Pencil size={13} />
                </button>
                <button onClick={() => duplicate(r.id)}
                  className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500">
                  <Copy size={13} />
                </button>
                <button onClick={() => remove(r.id)}
                  className="p-2 border border-slate-200 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
