import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { TrendingUp, Sparkles, RefreshCw, AlertTriangle } from 'lucide-react'
import api from '../../services/api'

type Estado = 'ok' | 'risk' | 'over' | 'none'
interface Cat {
  categoryId: string | null; name: string; color: string
  spent: number; projected: number; budget: number | null
  status: Estado; overBy: number; dailyAllowance: number | null
}
interface Forecast {
  day: number; daysInMonth: number; confidence: 'baja' | 'media' | 'alta'
  totals: { spent: number; projected: number; incomeMonth: number; avgIncome: number }
  categories: Cat[]
}
interface Insights {
  resumen?: string; alertas?: { categoria: string; mensaje: string }[]
  recomendaciones?: string[]; generatedAt?: string
}

const fmt = (n: number) => `$ ${Math.round(n || 0).toLocaleString('es-CO')}`
const ESTADO: Record<Estado, [string, string]> = {
  over: ['text-red-700 bg-red-50', 'Te pasarías'],
  risk: ['text-amber-700 bg-amber-50', 'En riesgo'],
  ok: ['text-emerald-700 bg-emerald-50', 'Vas bien'],
  none: ['text-slate-500 bg-slate-100', 'Sin presupuesto'],
}
const errorMsg = (e: unknown) =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'No se pudo generar el análisis'

export default function ForecastCard() {
  const qc = useQueryClient()
  const [verIA, setVerIA] = useState(false)
  const [refrescando, setRefrescando] = useState(false)

  const { data } = useQuery({
    queryKey: ['forecast'],
    queryFn: () => api.get('/forecast').then(r => r.data.data as Forecast),
    staleTime: 5 * 60_000,
  })
  const ia = useQuery({
    queryKey: ['forecast-insights'],
    queryFn: () => api.get('/forecast/insights').then(r => r.data.data as Insights),
    enabled: verIA, staleTime: 60 * 60_000, retry: false,
  })

  if (!data || data.categories.length === 0) return null

  const ingreso = Math.max(data.totals.incomeMonth, data.totals.avgIncome)
  const queda = ingreso ? ingreso - data.totals.projected : null
  const cats = data.categories.slice(0, 6)

  const actualizar = async () => {
    setRefrescando(true)
    try {
      const r = await api.post('/forecast/insights')
      qc.setQueryData(['forecast-insights'], r.data.data)
    } catch { /* el error se muestra abajo en el próximo intento */ }
    finally { setRefrescando(false) }
  }

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
            <TrendingUp size={16} className="text-brand-600" />Proyección del mes
          </h2>
          <p className="text-xs text-slate-400">Día {data.day} de {data.daysInMonth} · confianza {data.confidence}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-[11px] text-slate-400">Gastado</p>
          <p className="text-sm font-bold text-slate-800 tabular-nums">{fmt(data.totals.spent)}</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-[11px] text-slate-400">Al cierre (aprox.)</p>
          <p className="text-sm font-bold text-slate-800 tabular-nums">{fmt(data.totals.projected)}</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-[11px] text-slate-400">Te quedaría</p>
          <p className={`text-sm font-bold tabular-nums ${queda === null ? 'text-slate-400' : queda < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {queda === null ? '—' : fmt(queda)}
          </p>
        </div>
      </div>

      <ul className="divide-y divide-slate-100">
        {cats.map(c => {
          const escala = Math.max(c.projected, c.budget || 0, 1)
          const [cls, etiqueta] = ESTADO[c.status]
          return (
            <li key={c.categoryId ?? c.name} className="py-2.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium text-slate-700 truncate">{c.name}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${cls}`}>
                  {c.status === 'over' ? `${etiqueta} por ${fmt(c.overBy)}` : etiqueta}
                </span>
              </div>
              <div className="relative h-2.5 mt-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-0 rounded-full opacity-30"
                     style={{ width: `${(c.projected / escala) * 100}%`, backgroundColor: c.color }} />
                <div className="absolute inset-y-0 left-0 rounded-full"
                     style={{ width: `${(c.spent / escala) * 100}%`, backgroundColor: c.color }} />
                {c.budget ? (
                  <div className="absolute inset-y-0 w-0.5 bg-slate-700"
                       style={{ left: `calc(${Math.min(100, (c.budget / escala) * 100)}% - 1px)` }} />
                ) : null}
              </div>
              <div className="flex flex-wrap justify-between gap-x-3 text-[11px] text-slate-400 mt-1">
                <span>{fmt(c.spent)} gastado · ~{fmt(c.projected)} al cierre</span>
                {c.budget ? (
                  <span>Presupuesto {fmt(c.budget)}{c.dailyAllowance !== null ? ` · ${fmt(c.dailyAllowance)}/día` : ''}</span>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>

      {!verIA ? (
        <button onClick={() => setVerIA(true)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-violet-600 text-white hover:bg-violet-700">
          <Sparkles size={13} />Ver análisis con IA
        </button>
      ) : ia.isLoading || refrescando ? (
        <div className="h-20 bg-slate-50 rounded-xl animate-pulse" />
      ) : ia.error ? (
        <p className="text-xs text-red-600">{errorMsg(ia.error)}</p>
      ) : ia.data ? (
        <div className="bg-violet-50/60 border border-violet-100 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-violet-800 flex items-center gap-1.5"><Sparkles size={13} />Análisis con IA</p>
            <button onClick={actualizar} className="text-[11px] text-violet-700 flex items-center gap-1 hover:underline">
              <RefreshCw size={11} />Actualizar
            </button>
          </div>
          {ia.data.resumen && <p className="text-sm text-slate-700">{ia.data.resumen}</p>}
          {ia.data.alertas?.map((a, i) => (
            <p key={i} className="text-xs text-amber-800 flex gap-1.5">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" /><span><b>{a.categoria}:</b> {a.mensaje}</span>
            </p>
          ))}
          {ia.data.recomendaciones && ia.data.recomendaciones.length > 0 && (
            <ul className="list-disc pl-5 space-y-1 text-sm text-slate-600">
              {ia.data.recomendaciones.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          )}
        </div>
      ) : null}

      <p className="text-[11px] text-slate-400">
        Estimación con tu ritmo de este mes y tu promedio de los últimos meses. Los gastos grandes de una sola vez no se proyectan como diarios.
      </p>
    </section>
  )
}
