// src/pages/PomodoroPage.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Play, Pause, RotateCcw, Check, Coffee, Brain, Timer } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../services/api'

type Phase = 'work' | 'break' | 'idle'

const pomodoroApi = {
  stats:  (days?: number) => api.get('/pomodoro/stats', { params: { days } }),
  list:   () => api.get('/pomodoro'),
  create: (d: Record<string,unknown>) => api.post('/pomodoro', d),
}

export default function PomodoroPage() {
  const qc = useQueryClient()
  const [workMin, setWorkMin]   = useState(25)
  const [breakMin, setBreakMin] = useState(5)
  const [phase, setPhase]       = useState<Phase>('idle')
  const [running, setRunning]   = useState(false)
  const [seconds, setSeconds]   = useState(25 * 60)
  const [rounds, setRounds]     = useState(0)
  const [title, setTitle]       = useState('Sesión de trabajo')
  const [totalMins, setTotalMins] = useState(0)
  const startedAt = useRef<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { data: stats } = useQuery({ queryKey:['pomodoro-stats'], queryFn: () => pomodoroApi.stats(7).then(r => r.data.data) })

  const totalSeconds = phase === 'break' ? breakMin * 60 : workMin * 60
  const pct = ((totalSeconds - seconds) / totalSeconds) * 100
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60

  const save = useCallback(async () => {
    if (rounds === 0 && totalMins === 0) return
    try {
      await pomodoroApi.create({ title, workMinutes: workMin, breakMinutes: breakMin, rounds, totalMinutes: totalMins })
      qc.invalidateQueries({ queryKey: ['pomodoro-stats'] })
    } catch {}
  }, [title, workMin, breakMin, rounds, totalMins, qc])

  const tick = useCallback(() => {
    setSeconds(s => {
      if (s <= 1) {
        if (phase === 'work') {
          toast.success('🍅 ¡Pomodoro completado! Descansa.')
          setRounds(r => r + 1)
          setTotalMins(t => t + workMin)
          setPhase('break')
          return breakMin * 60
        } else {
          toast.success('☕ ¡Descanso terminado! A trabajar.')
          setPhase('work')
          return workMin * 60
        }
      }
      return s - 1
    })
  }, [phase, workMin, breakMin])

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(tick, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running, tick])

  const start = () => {
    if (phase === 'idle') { setPhase('work'); setSeconds(workMin * 60) }
    if (!startedAt.current) startedAt.current = new Date()
    setRunning(true)
  }

  const pause = () => setRunning(false)

  const reset = async () => {
    setRunning(false)
    await save()
    setPhase('idle'); setSeconds(workMin * 60); setRounds(0); setTotalMins(0)
    startedAt.current = null
    toast.success(`Sesión guardada: ${rounds} rondas · ${totalMins} min`)
  }

  const strokeDash = 2 * Math.PI * 80
  const strokeOffset = strokeDash * (1 - pct / 100)

  const phaseColor = phase === 'break' ? '#185FA5' : '#0F6E56'
  const phaseLabel = phase === 'idle' ? 'Listo' : phase === 'work' ? 'Enfocado' : 'Descansando'

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-dark flex items-center gap-2">
          <Timer size={20} className="text-brand-600" />Pomodoro
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">Técnica de trabajo por intervalos de enfoque</p>
      </div>

      {/* Timer */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8 flex flex-col items-center gap-6">
        {/* Title input */}
        <input value={title} onChange={e => setTitle(e.target.value)} disabled={running}
          className="text-center text-sm font-medium text-slate-500 border-0 border-b border-slate-200 pb-1 focus:outline-none focus:border-brand-400 w-full bg-transparent"
          placeholder="¿En qué vas a trabajar?" />

        {/* Circular timer */}
        <div className="relative">
          <svg width="200" height="200" className="-rotate-90">
            <circle cx="100" cy="100" r="80" fill="none" stroke="#f1f5f9" strokeWidth="10" />
            <circle cx="100" cy="100" r="80" fill="none" stroke={phaseColor} strokeWidth="10"
              strokeDasharray={strokeDash} strokeDashoffset={strokeOffset}
              strokeLinecap="round" className="transition-all duration-1000" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-dark tabular-nums">
              {String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')}
            </span>
            <span className="text-xs font-medium mt-1" style={{ color: phaseColor }}>{phaseLabel}</span>
            {rounds > 0 && <span className="text-xs text-slate-400 mt-1">🍅 × {rounds}</span>}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {phase !== 'idle' && (
            <button onClick={reset} className="w-11 h-11 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50">
              <RotateCcw size={16} />
            </button>
          )}
          <button onClick={running ? pause : start}
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold shadow-lg hover:scale-105 active:scale-95 transition-all"
            style={{ backgroundColor: phaseColor }}>
            {running ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
          </button>
          {phase === 'work' && running && (
            <button onClick={() => { setPhase('break'); setSeconds(breakMin*60) }}
              className="w-11 h-11 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50" title="Saltar a descanso">
              <Coffee size={16} />
            </button>
          )}
        </div>

        {/* Config (solo cuando idle) */}
        {phase === 'idle' && (
          <div className="flex items-center gap-4 border-t border-slate-100 pt-4 w-full justify-center">
            <div className="text-center">
              <label className="text-xs text-slate-400 block mb-1">Trabajo (min)</label>
              <div className="flex items-center gap-1">
                <button onClick={() => { setWorkMin(w => Math.max(5,w-5)); setSeconds(Math.max(5*60, workMin*60-5*60)) }}
                  className="w-7 h-7 rounded-lg bg-slate-100 text-sm hover:bg-slate-200">−</button>
                <span className="w-8 text-center font-bold text-dark">{workMin}</span>
                <button onClick={() => { setWorkMin(w => Math.min(60,w+5)); setSeconds(Math.min(60*60, workMin*60+5*60)) }}
                  className="w-7 h-7 rounded-lg bg-slate-100 text-sm hover:bg-slate-200">+</button>
              </div>
            </div>
            <div className="text-center">
              <label className="text-xs text-slate-400 block mb-1">Descanso (min)</label>
              <div className="flex items-center gap-1">
                <button onClick={() => setBreakMin(b => Math.max(1,b-1))} className="w-7 h-7 rounded-lg bg-slate-100 text-sm hover:bg-slate-200">−</button>
                <span className="w-8 text-center font-bold text-dark">{breakMin}</span>
                <button onClick={() => setBreakMin(b => Math.min(30,b+1))} className="w-7 h-7 rounded-lg bg-slate-100 text-sm hover:bg-slate-200">+</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label:'Sesiones', value: stats.totalSessions, icon:<Check size={14} /> },
            { label:'Min totales', value: stats.totalMinutes, icon:<Timer size={14} /> },
            { label:'Min/día', value: stats.avgMinutesPerDay, icon:<Brain size={14} /> },
          ].map(({ label, value, icon }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <div className="flex justify-center text-brand-600 mb-1">{icon}</div>
              <p className="text-xl font-bold text-dark">{value}</p>
              <p className="text-xs text-slate-400">{label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
