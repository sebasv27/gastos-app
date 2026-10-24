// src/components/exercises/ExercisePicker.tsx
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X, Info, ChevronLeft, Plus, Dumbbell } from 'lucide-react'
import { exerciseApi } from '../../services/api'

export interface ExerciseLite {
  id: string
  name: string
  nameEn?: string | null
  muscleGroup: string
  equipment?: string | null
  level?: string | null
  category?: string | null
  isDefault: boolean
  userId?: string | null
  image?: string | null
}

interface ExerciseDetail extends Omit<ExerciseLite, 'image'> {
  images: string[]
  instructions: string[]
  primaryMuscles: string[]
  secondaryMuscles: string[]
}

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (exercise: ExerciseLite) => void
  excludeIds?: string[]
}

const PAGE = 30

const NIVEL: Record<string, string> = {
  beginner: 'Principiante', intermediate: 'Intermedio', expert: 'Avanzado',
}

const MUSCULO: Record<string, string> = {
  abdominals: 'Abdomen', chest: 'Pecho', shoulders: 'Hombros', neck: 'Cuello',
  biceps: 'Bíceps', triceps: 'Tríceps', forearms: 'Antebrazos',
  lats: 'Dorsales', 'middle back': 'Espalda media', 'lower back': 'Espalda baja',
  traps: 'Trapecios', quadriceps: 'Cuádriceps', hamstrings: 'Isquiotibiales',
  glutes: 'Glúteos', calves: 'Pantorrillas', adductors: 'Aductores', abductors: 'Abductores',
}

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

function Thumb({ src, className = 'w-14 h-14' }: { src?: string | null; className?: string }) {
  const [error, setError] = useState(false)
  if (!src || error) {
    return (
      <div className={`${className} rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center shrink-0`}>
        <Dumbbell size={20} />
      </div>
    )
  }
  return (
    <img
      src={src} alt="" loading="lazy" onError={() => setError(true)}
      className={`${className} rounded-xl object-cover bg-slate-100 shrink-0`}
    />
  )
}

function Detail({ id, added, onBack, onSelect }: {
  id: string; added: boolean; onBack: () => void; onSelect: (e: ExerciseLite) => void
}) {
  const { data: ex, isLoading } = useQuery({
    queryKey: ['exercise', id],
    queryFn: () => exerciseApi.get(id).then(r => r.data.data as ExerciseDetail),
  })

  // Alterna entre las fotos de inicio y fin del movimiento
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    if (!ex || ex.images.length < 2) return
    const t = setInterval(() => setFrame(f => (f + 1) % ex.images.length), 900)
    return () => clearInterval(t)
  }, [ex])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        <button onClick={onBack} className="p-1.5 -ml-1.5 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Volver">
          <ChevronLeft size={20} />
        </button>
        <h3 className="text-sm font-semibold text-slate-800 truncate">{ex?.name ?? 'Cargando...'}</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading || !ex ? (
          <div className="h-56 rounded-xl bg-slate-100 animate-pulse" />
        ) : (
          <>
            {ex.images.length > 0 && (
              <img src={ex.images[frame]} alt={ex.name}
                   className="w-full max-h-72 object-contain rounded-xl bg-slate-50" />
            )}

            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">{ex.muscleGroup}</span>
              {ex.equipment && <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">{ex.equipment}</span>}
              {ex.level && <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">{NIVEL[ex.level] ?? ex.level}</span>}
            </div>

            {(ex.primaryMuscles?.length > 0 || ex.secondaryMuscles?.length > 0) && (
              <div className="text-sm text-slate-600 space-y-0.5">
                {ex.primaryMuscles?.length > 0 && (
                  <p><span className="font-medium text-slate-800">Principal:</span> {ex.primaryMuscles.map(m => MUSCULO[m] ?? m).join(', ')}</p>
                )}
                {ex.secondaryMuscles?.length > 0 && (
                  <p><span className="font-medium text-slate-800">Secundarios:</span> {ex.secondaryMuscles.map(m => MUSCULO[m] ?? m).join(', ')}</p>
                )}
              </div>
            )}

            {ex.instructions.length > 0 && (
              <ol className="space-y-2">
                {ex.instructions.map((paso, i) => (
                  <li key={i} className="flex gap-3 text-sm text-slate-700">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="pt-0.5">{paso}</span>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>

      <div className="p-4 border-t border-slate-100">
        <button
          disabled={!ex || added}
          onClick={() => ex && onSelect({ ...ex, image: ex.images[0] ?? null })}
          className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {added ? 'Ya está en la rutina' : <><Plus size={16} /> Agregar ejercicio</>}
        </button>
      </div>
    </div>
  )
}

export default function ExercisePicker({ open, onClose, onSelect, excludeIds = [] }: Props) {
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('')
  const [equip, setEquip] = useState('')
  const [pages, setPages] = useState(1)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [shown, setShown] = useState<{ data: ExerciseLite[]; total: number }>({ data: [], total: 0 })
  const dq = useDebounced(q.trim())

  // Volver a la primera página cuando cambian los filtros
  useEffect(() => { setPages(1) }, [dq, group, equip])

  // Cerrar con Esc
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => { if (!open) setDetailId(null) }, [open])

  const { data: meta } = useQuery({
    queryKey: ['exercise-meta'],
    queryFn: () => exerciseApi.meta().then(r => r.data.data as {
      muscleGroups: { value: string; count: number }[]
      equipment: { value: string; count: number }[]
    }),
    enabled: open,
    staleTime: 5 * 60_000,
  })

  const { data, isFetching } = useQuery({
    queryKey: ['exercise-search', dq, group, equip, pages],
    queryFn: () => exerciseApi.list({
      q: dq || undefined,
      muscleGroup: group || undefined,
      equipment: equip || undefined,
      limit: Math.min(PAGE * pages, 200),
      offset: 0,
    }).then(r => r.data as { data: ExerciseLite[]; total: number }),
    enabled: open,
    staleTime: 60_000,
  })

  // Mantener la lista visible mientras carga la siguiente página
  useEffect(() => { if (data) setShown(data) }, [data])

  if (!open) return null

  const puedeCargarMas = shown.data.length < shown.total && shown.data.length < 200

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-2xl h-[92vh] sm:h-[85vh] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {detailId ? (
          <Detail
            id={detailId}
            added={excludeIds.includes(detailId)}
            onBack={() => setDetailId(null)}
            onSelect={ex => { onSelect(ex); setDetailId(null) }}
          />
        ) : (
          <>
            <div className="px-4 pt-4 pb-3 border-b border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-800">Agregar ejercicio</h2>
                <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Cerrar">
                  <X size={20} />
                </button>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    autoFocus value={q} onChange={e => setQ(e.target.value)}
                    placeholder="Buscar: press, sentadilla, curl..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30"
                  />
                </div>
                <select
                  value={equip} onChange={e => setEquip(e.target.value)}
                  className="max-w-[40%] px-2 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white"
                >
                  <option value="">Todo equipo</option>
                  {meta?.equipment.map(e => (
                    <option key={e.value} value={e.value}>{e.value} ({e.count})</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4">
                {[{ value: '', count: 0 }, ...(meta?.muscleGroups ?? [])].map(g => (
                  <button
                    key={g.value || 'todos'} onClick={() => setGroup(g.value)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      group === g.value
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {g.value || 'Todos'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {shown.data.length === 0 && !isFetching ? (
                <p className="py-12 text-center text-sm text-slate-500">No encontré ejercicios con esos filtros.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {shown.data.map(e => {
                    const added = excludeIds.includes(e.id)
                    return (
                      <li key={e.id} className={`flex items-center gap-3 px-4 py-2.5 ${added ? 'opacity-50' : 'hover:bg-slate-50'}`}>
                        <button
                          disabled={added} onClick={() => onSelect(e)}
                          className="flex items-center gap-3 flex-1 min-w-0 text-left"
                        >
                          <Thumb src={e.image} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">
                              {e.name}
                              {!e.isDefault && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 align-middle">Tuyo</span>}
                            </p>
                            <p className="text-xs text-slate-400 truncate">
                              {e.muscleGroup}
                              {e.equipment && ` · ${e.equipment}`}
                              {e.level && ` · ${NIVEL[e.level] ?? e.level}`}
                            </p>
                          </div>
                        </button>
                        {added ? (
                          <span className="text-xs text-slate-400 shrink-0">Agregado</span>
                        ) : (
                          <button onClick={() => setDetailId(e.id)} className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-slate-100 shrink-0" aria-label="Ver detalle">
                            <Info size={18} />
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}

              {puedeCargarMas && (
                <div className="p-4">
                  <button
                    onClick={() => setPages(p => p + 1)} disabled={isFetching}
                    className="w-full py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {isFetching ? 'Cargando...' : 'Cargar más'}
                  </button>
                </div>
              )}
            </div>

            <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400">
              {isFetching && shown.data.length === 0 ? 'Buscando...' : `Mostrando ${shown.data.length} de ${shown.total}`}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
