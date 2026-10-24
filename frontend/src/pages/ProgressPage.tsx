// src/pages/ProgressPage.tsx
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell
} from 'recharts'
import { Plus, TrendingDown, TrendingUp, Minus, Trash2, Scale, Dumbbell } from 'lucide-react'
import toast from 'react-hot-toast'
import { bodyLogApi, workoutSessionApi } from '../services/api'
import { fmtShortDate } from '../utils/format'
import { BodyProgress, VolumeWeek } from '../types'

const RANGES = [
  { label: '30 días', days: 30 },
  { label: '90 días', days: 90 },
  { label: '6 meses', days: 180 },
  { label: '1 año',   days: 365 },
]

export default function ProgressPage() {
  const qc = useQueryClient()
  const [range, setRange] = useState(90)
  const [showAdd, setShowAdd] = useState(false)
  const [weight, setWeight]   = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [saving, setSaving]   = useState(false)

  const { data: progress, isLoading } = useQuery({
    queryKey: ['body-progress', range],
    queryFn: () => bodyLogApi.getProgress(range).then(r => r.data.data as BodyProgress)
  })

  const { data: volumeTrend } = useQuery({
    queryKey: ['volume-trend'],
    queryFn: () => workoutSessionApi.getVolumeTrend(8).then(r => r.data.data as VolumeWeek[])
  })

  const addWeight = async () => {
    if (!weight || parseFloat(weight) <= 0) { toast.error('Ingresa un peso válido'); return }
    setSaving(true)
    try {
      await bodyLogApi.create({ weightKg: parseFloat(weight), bodyFatPct: bodyFat || undefined })
      toast.success('Peso registrado')
      setWeight(''); setBodyFat(''); setShowAdd(false)
      qc.invalidateQueries({ queryKey: ['body-progress'] })
      qc.invalidateQueries({ queryKey: ['fitness-profile'] })
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const deleteLog = async (id: string) => {
    try {
      await bodyLogApi.remove(id)
      qc.invalidateQueries({ queryKey: ['body-progress'] })
      toast.success('Eliminado')
    } catch { toast.error('Error al eliminar') }
  }

  const delta = progress?.delta
  const trendIcon = !delta ? null : delta.kg > 0.3
    ? <TrendingUp size={14} className="text-amber-500" />
    : delta.kg < -0.3
      ? <TrendingDown size={14} className="text-brand-500" />
      : <Minus size={14} className="text-slate-400" />

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-dark">Progreso</h1>
          <p className="text-slate-500 text-sm mt-0.5">Peso corporal y volumen de entrenamiento</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 bg-brand-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-brand-700">
          <Plus size={14} />Registrar peso
        </button>
      </div>

      {/* Add weight inline form */}
      {showAdd && (
        <div className="bg-white rounded-xl border border-brand-200 p-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-xs text-slate-500 mb-1 block">Peso (kg)</label>
              <input autoFocus type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)}
                placeholder="75.5"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-500 mb-1 block">% Grasa (opcional)</label>
              <input type="number" step="0.1" value={bodyFat} onChange={e => setBodyFat(e.target.value)}
                placeholder="15.0"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <button onClick={addWeight} disabled={saving}
              className="bg-brand-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
              {saving ? '...' : 'Guardar'}
            </button>
            <button onClick={() => setShowAdd(false)}
              className="text-slate-400 hover:text-slate-600 px-2 py-2 text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Range selector */}
      <div className="flex gap-1.5">
        {RANGES.map(r => (
          <button key={r.days} onClick={() => setRange(r.days)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors
              ${range === r.days ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
            {r.label}
          </button>
        ))}
      </div>

      {/* Weight chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Scale size={15} className="text-brand-600" />
            <h2 className="text-sm font-semibold text-dark">Peso corporal</h2>
          </div>
          {delta && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              {trendIcon}
              {delta.kg > 0 ? '+' : ''}{delta.kg} kg en {delta.days} días
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="h-56 flex items-center justify-center text-slate-300">Cargando...</div>
        ) : !progress || progress.logs.length === 0 ? (
          <div className="h-56 flex flex-col items-center justify-center text-center">
            <Scale size={28} className="text-slate-200 mb-2" />
            <p className="text-slate-400 text-sm">Sin registros de peso todavía</p>
            <button onClick={() => setShowAdd(true)} className="text-brand-600 text-xs font-medium mt-2 hover:underline">
              Registrar el primero →
            </button>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={progress.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tickFormatter={d => fmtShortDate(d)} tick={{ fontSize: 11 }} />
              <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 11 }} width={40} />
              <Tooltip
                labelFormatter={d => fmtShortDate(d as string)}
                formatter={(v: number, name: string) => [`${v} kg`, name === 'weightKg' ? 'Peso' : 'Tendencia']}
              />
              <Line type="monotone" dataKey="weightKg" stroke="#cbd5e1" strokeWidth={1.5} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="trendKg" stroke="#0F6E56" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Volume chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Dumbbell size={15} className="text-brand-600" />
          <h2 className="text-sm font-semibold text-dark">Volumen de entreno semanal</h2>
        </div>
        {!volumeTrend || volumeTrend.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
            Sin sesiones de entreno registradas
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={volumeTrend} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="week" tickFormatter={d => fmtShortDate(d)} tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={40} />
              <Tooltip
                labelFormatter={d => fmtShortDate(d as string)}
                formatter={(v: number) => [`${Math.round(v).toLocaleString()} kg`, 'Volumen total']}
              />
              <Bar dataKey="volume" radius={[6, 6, 0, 0]}>
                {volumeTrend.map((_, i) => (
                  <Cell key={i} fill={i === volumeTrend.length - 1 ? '#0F6E56' : '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Recent logs list */}
      {progress && progress.logs.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-dark">Registros recientes</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {[...progress.logs].reverse().slice(0, 8).map(log => (
              <div key={log.id} className="flex items-center justify-between px-5 py-2.5 group">
                <div>
                  <span className="text-sm font-medium text-dark">{log.weightKg} kg</span>
                  {log.bodyFatPct && (
                    <span className="text-xs text-slate-400 ml-2">{log.bodyFatPct}% grasa</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{fmtShortDate(log.date)}</span>
                  <button onClick={() => deleteLog(log.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-500">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
