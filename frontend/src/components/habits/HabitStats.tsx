import { useQuery } from '@tanstack/react-query'
import { Flame, Trophy, Target, CalendarCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { habitApi } from '../../services/api'

interface HabitStat {
  id: string; name: string; emoji: string; color: string
  targetDays: number[]; startDate: string; doneToday: boolean
  currentStreak: number; bestStreak: number; totalDone: number
  rate7: number | null; rate30: number | null; days: string[]
}
interface Stats {
  today: string
  summary: {
    activeHabits: number; doneToday: number; weekRate: number | null
    topStreak: { name: string; emoji: string; streak: number } | null
  }
  weekdays: { day: number; pct: number | null }[]
  habits: HabitStat[]
}

const SEMANAS = 26
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const DIAS_LARGO = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos']

const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const isoDow = (key: string) => { const g = new Date(`${key}T00:00:00Z`).getUTCDay(); return g === 0 ? 7 : g }
const pct = (v: number | null) => (v === null ? '—' : `${v}%`)

function Card({ icon, label, value, sub }: { icon: ReactNode; label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-xs text-slate-400">{icon}{label}</div>
      <p className="text-xl font-bold text-slate-800 mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-400 truncate mt-0.5">{sub}</p>}
    </div>
  )
}

function Heatmap({ h, today }: { h: HabitStat; today: string }) {
  const hechos = new Set(h.days)
  const target = new Set(h.targetDays)
  const lunes = addDays(today, -(isoDow(today) - 1))
  const inicio = addDays(lunes, -7 * (SEMANAS - 1))
  const semanas = Array.from({ length: SEMANAS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(inicio, w * 7 + d)))

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-[3px] w-max">
        {semanas.map((sem, i) => (
          <div key={i} className="flex flex-col gap-[3px]">
            {sem.map(k => {
              const hecho = hechos.has(k)
              const programado = target.has(isoDow(k)) && k <= today && k >= h.startDate
              return (
                <div
                  key={k}
                  title={`${k}${hecho ? ' · cumplido' : programado ? ' · no cumplido' : ''}`}
                  className={`w-[10px] h-[10px] rounded-[2px] ${hecho ? '' : programado ? 'bg-slate-200' : 'bg-slate-50'}`}
                  style={hecho ? { backgroundColor: h.color } : undefined}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function HabitStats() {
  const { data, isLoading } = useQuery({
    queryKey: ['habit-stats'],
    queryFn: () => habitApi.stats().then(r => r.data.data as Stats),
  })

  if (isLoading) return <div className="h-40 mt-8 bg-white border border-slate-200 rounded-2xl animate-pulse" />
  if (!data || data.habits.length === 0) return null

  const { summary, weekdays, habits, today } = data
  const conDatos = weekdays.filter(w => w.pct !== null)
  const peor = conDatos.length >= 3 ? conDatos.reduce((a, b) => (b.pct! < a.pct! ? b : a)) : null
  const mejor = conDatos.length >= 3 ? conDatos.reduce((a, b) => (b.pct! > a.pct! ? b : a)) : null

  return (
    <section className="space-y-4 mt-8">
      <h2 className="text-base font-semibold text-slate-800">Estadísticas</h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card icon={<CalendarCheck size={13} />} label="Hoy" value={`${summary.doneToday}/${summary.activeHabits}`} />
        <Card icon={<Target size={13} />} label="Últimos 7 días" value={pct(summary.weekRate)} />
        <Card
          icon={<Flame size={13} className="text-amber-500" />} label="Mejor racha actual"
          value={summary.topStreak ? `${summary.topStreak.streak} días` : '—'}
          sub={summary.topStreak ? `${summary.topStreak.emoji} ${summary.topStreak.name}` : undefined}
        />
        <Card icon={<Trophy size={13} />} label="Hábitos activos" value={summary.activeHabits} />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <p className="text-sm font-medium text-slate-700">Cumplimiento por día</p>
        <p className="text-xs text-slate-400">Últimos 90 días, todos los hábitos</p>
        <div className="flex items-stretch gap-2 h-32 mt-3">
          {weekdays.map(w => (
            <div key={w.day} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-slate-400 h-3">{w.pct === null ? '' : `${w.pct}%`}</span>
              <div className="w-full flex-1 flex items-end bg-slate-50 rounded-md overflow-hidden">
                <div className="w-full bg-brand-600 rounded-md transition-all" style={{ height: `${w.pct ?? 0}%` }} />
              </div>
              <span className="text-xs text-slate-500">{DIAS[w.day - 1]}</span>
            </div>
          ))}
        </div>
        {peor && mejor && peor.day !== mejor.day && (
          <p className="text-xs text-slate-500 mt-3">
            Tu mejor día son los <b>{DIAS_LARGO[mejor.day - 1]}</b> ({mejor.pct}%) y el más difícil, los{' '}
            <b>{DIAS_LARGO[peor.day - 1]}</b> ({peor.pct}%).
          </p>
        )}
      </div>

      <div className="space-y-3">
        {habits.map(h => (
          <div key={h.id} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800 truncate">{h.emoji} {h.name}</p>
              <span className="flex items-center gap-1 text-sm font-semibold text-amber-600 shrink-0">
                <Flame size={14} /> {h.currentStreak}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                ['Mejor racha', `${h.bestStreak}`],
                ['7 días', pct(h.rate7)],
                ['30 días', pct(h.rate30)],
                ['Total', `${h.totalDone}`],
              ].map(([l, v]) => (
                <div key={l} className="bg-slate-50 rounded-xl py-2">
                  <p className="text-sm font-semibold text-slate-800">{v}</p>
                  <p className="text-[10px] text-slate-400">{l}</p>
                </div>
              ))}
            </div>
            <Heatmap h={h} today={today} />
          </div>
        ))}
      </div>
    </section>
  )
}
