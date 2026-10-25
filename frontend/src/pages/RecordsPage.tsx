import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trophy, ChevronDown, ChevronUp, Search } from 'lucide-react'
import { exerciseApi } from '../services/api'
import ExerciseThumb from '../components/exercises/ExerciseThumb'
import OneRepMaxCalculator from '../components/exercises/OneRepMaxCalculator'

interface Rec {
  exerciseId: string
  name: string
  muscleGroup: string
  equipment?: string | null
  image?: string | null
  totalSets: number
  lastDate: string
  bestWeight: { weightKg: number; reps: number; date: string } | null
  bestE1rm: { value: number; weightKg: number; reps: number; date: string } | null
  bestReps: { reps: number; weightKg: number; date: string } | null
}

interface HistPoint { date: string; maxWeight: number; bestE1rm?: number | null }

const fmtKg = (n: number) => `${n.toLocaleString('es-CO', { maximumFractionDigits: 1 })} kg`
const fmtFecha = (d: string) =>
  new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' }).replace('.', '')
const fmtCarga = (w: number, r: number) => (w > 0 ? `${fmtKg(w)} × ${r}` : `${r} reps (peso corporal)`)

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) {
    return <p className="text-xs text-slate-400">Registra más sesiones de este ejercicio para ver tu progreso.</p>
  }
  const W = 300, H = 70, P = 6
  const min = Math.min(...points), max = Math.max(...points), rango = max - min || 1
  const xy = points.map((v, i) => [P + (i * (W - 2 * P)) / (points.length - 1), H - P - ((v - min) * (H - 2 * P)) / rango])
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [lx, ly] = xy[xy.length - 1]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto text-brand-600">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="4" fill="currentColor" />
    </svg>
  )
}

function Historial({ exerciseId }: { exerciseId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['exercise-history', exerciseId],
    queryFn: () => exerciseApi.getHistory(exerciseId).then(r => r.data.data as HistPoint[]),
  })
  if (isLoading) return <div className="h-20 bg-slate-100 rounded-lg animate-pulse" />
  const usaE1 = (data ?? []).some(p => p.bestE1rm)
  const pts = (data ?? []).map(p => (usaE1 ? p.bestE1rm ?? 0 : p.maxWeight)).filter(v => v > 0)
  return (
    <div className="space-y-1">
      <p className="text-xs text-slate-500">{usaE1 ? '1RM estimado' : 'Peso máximo'} por sesión</p>
      <Sparkline points={pts} />
      {pts.length >= 2 && (
        <div className="flex justify-between text-[11px] text-slate-400">
          <span>Primera: {fmtKg(pts[0])}</span>
          <span>Última: {fmtKg(pts[pts.length - 1])}</span>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3">
      <p className="text-[11px] text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-slate-800 mt-0.5">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function RecordsPage() {
  const [q, setQ] = useState('')
  const [abierto, setAbierto] = useState<string | null>(null)
  const [calc, setCalc] = useState<{ w: number; r: number; name?: string } | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['exercise-records'],
    queryFn: () => exerciseApi.records().then(r => r.data.data as Rec[]),
  })

  const filtro = q.trim().toLowerCase()
  const lista = data.filter(r => r.name.toLowerCase().includes(filtro))
  const podio = data.filter(r => r.bestE1rm).slice(0, 3)

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
          <Trophy size={20} className="text-amber-500" /> Mis récords
        </h1>
        <p className="text-sm text-slate-500">Tu mejor marca en cada ejercicio · 1RM estimado con la fórmula de Epley</p>
      </div>

      <OneRepMaxCalculator preset={calc} />

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => <div key={i} className="h-16 bg-white border border-slate-200 rounded-2xl animate-pulse" />)}
        </div>
      ) : data.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <Trophy size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-600">Aún no tienes series registradas.</p>
          <p className="text-xs text-slate-400 mt-1">Completa una sesión de entreno y aquí aparecerán tus mejores marcas.</p>
        </div>
      ) : (
        <>
          {podio.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {podio.map((r, i) => (
                <div key={r.exerciseId} className="bg-white border border-slate-200 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{['🥇', '🥈', '🥉'][i]}</span>
                    <p className="text-sm font-medium text-slate-700 truncate">{r.name}</p>
                  </div>
                  <p className="text-2xl font-bold text-slate-800">{fmtKg(r.bestE1rm!.value)}</p>
                  <p className="text-xs text-slate-400">1RM estimado · {fmtCarga(r.bestE1rm!.weightKg, r.bestE1rm!.reps)}</p>
                </div>
              ))}
            </div>
          )}

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar ejercicio..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/30"
            />
          </div>

          <ul className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
            {lista.map(r => {
              const open = abierto === r.exerciseId
              return (
                <li key={r.exerciseId}>
                  <button
                    onClick={() => setAbierto(open ? null : r.exerciseId)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <ExerciseThumb src={r.image} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{r.name}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {r.muscleGroup} · {r.totalSets} series · último {fmtFecha(r.lastDate)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {r.bestE1rm ? (
                        <>
                          <p className="text-sm font-semibold text-slate-800">{fmtKg(r.bestE1rm.value)}</p>
                          <p className="text-[11px] text-slate-400">1RM est.</p>
                        </>
                      ) : r.bestReps ? (
                        <>
                          <p className="text-sm font-semibold text-slate-800">{r.bestReps.reps} reps</p>
                          <p className="text-[11px] text-slate-400">máximo</p>
                        </>
                      ) : null}
                    </div>
                    {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                  </button>

                  {open && (
                    <div className="px-4 pb-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {r.bestWeight && (
                          <Stat label="Peso máximo" value={fmtCarga(r.bestWeight.weightKg, r.bestWeight.reps)} sub={fmtFecha(r.bestWeight.date)} />
                        )}
                        {r.bestE1rm && (
                          <Stat label="1RM estimado" value={fmtKg(r.bestE1rm.value)} sub={`${fmtCarga(r.bestE1rm.weightKg, r.bestE1rm.reps)} · ${fmtFecha(r.bestE1rm.date)}`} />
                        )}
                        {r.bestReps && (
                          <Stat label="Más repeticiones" value={`${r.bestReps.reps} reps`} sub={`${r.bestReps.weightKg > 0 ? fmtKg(r.bestReps.weightKg) : 'peso corporal'} · ${fmtFecha(r.bestReps.date)}`} />
                        )}
                      </div>
                      <Historial exerciseId={r.exerciseId} />
                      {r.bestE1rm && (
                        <button
                          onClick={() => setCalc({ w: r.bestE1rm!.weightKg, r: r.bestE1rm!.reps, name: r.name })}
                          className="text-xs font-medium text-brand-600 hover:underline"
                        >
                          Calcular cargas con este récord →
                        </button>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
            {lista.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-slate-500">Ningún ejercicio coincide con la búsqueda.</li>
            )}
          </ul>
        </>
      )}
    </div>
  )
}
