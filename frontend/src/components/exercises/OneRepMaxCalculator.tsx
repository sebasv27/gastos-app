import { useEffect, useRef, useState } from 'react'
import { Calculator } from 'lucide-react'

const PCTS = [100, 95, 90, 85, 80, 75, 70, 65, 60]

/** 1RM estimado (Epley): peso × (1 + reps/30) */
export const epley = (w: number, r: number) => (r === 1 ? w : w * (1 + r / 30))

/** Reps aproximadas a un % del 1RM (Epley invertida) */
const repsAt = (pct: number) => (pct >= 100 ? 1 : Math.max(1, Math.round(30 * (100 / pct - 1))))

const fmt = (x: number) => x.toLocaleString('es-CO', { maximumFractionDigits: 1 })

interface Props {
  preset?: { w: number; r: number; name?: string } | null
}

export default function OneRepMaxCalculator({ preset }: Props) {
  const [peso, setPeso] = useState('')
  const [reps, setReps] = useState('')
  const [paso, setPaso] = useState(2.5)
  const [origen, setOrigen] = useState<string | undefined>()
  const ref = useRef<HTMLDivElement>(null)

  // Llenar con un récord cuando se pide desde la lista
  useEffect(() => {
    if (!preset) return
    setPeso(String(preset.w))
    setReps(String(preset.r))
    setOrigen(preset.name)
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [preset])

  const w = parseFloat(peso.replace(',', '.'))
  const r = parseInt(reps)
  const valido = w > 0 && r >= 1 && r <= 12
  const rm = valido ? epley(w, r) : null
  const redondear = (x: number) => Math.round(x / paso) * paso

  const input = 'w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-600/30'

  return (
    <div ref={ref} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 scroll-mt-4">
      <div className="flex items-center gap-2 min-w-0">
        <Calculator size={18} className="text-brand-600 shrink-0" />
        <h2 className="text-sm font-semibold text-slate-800 shrink-0">Calculadora de 1RM</h2>
        {origen && <span className="text-xs text-slate-400 truncate">· {origen}</span>}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-slate-500">
          Peso (kg)
          <input inputMode="decimal" value={peso} placeholder="80" className={input}
                 onChange={e => { setPeso(e.target.value); setOrigen(undefined) }} />
        </label>
        <label className="text-xs text-slate-500">
          Repeticiones
          <input inputMode="numeric" value={reps} placeholder="5" className={input}
                 onChange={e => { setReps(e.target.value); setOrigen(undefined) }} />
        </label>
        <label className="text-xs text-slate-500">
          Redondeo
          <select value={paso} onChange={e => setPaso(parseFloat(e.target.value))} className={input}>
            {[1, 2.5, 5].map(p => <option key={p} value={p}>{fmt(p)} kg</option>)}
          </select>
        </label>
      </div>

      {r > 12 && (
        <p className="text-xs text-amber-600">
          Con más de 12 repeticiones la estimación pierde precisión. Usa una serie más pesada (12 reps o menos).
        </p>
      )}

      {rm && (
        <>
          <div className="bg-slate-50 rounded-xl p-4 text-center">
            <p className="text-xs text-slate-500">1RM estimado</p>
            <p className="text-3xl font-bold text-slate-800 tabular-nums">{fmt(rm)} kg</p>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 text-left">
                <th className="font-medium py-1">% del 1RM</th>
                <th className="font-medium py-1 text-right">Carga</th>
                <th className="font-medium py-1 text-right">Reps aprox.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {PCTS.map(p => (
                <tr key={p}>
                  <td className="py-1.5 text-slate-600">{p}%</td>
                  <td className="py-1.5 text-right font-medium text-slate-800 tabular-nums">{fmt(redondear((rm * p) / 100))} kg</td>
                  <td className="py-1.5 text-right text-slate-500 tabular-nums">{p === 100 ? '1' : `~${repsAt(p)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-[11px] text-slate-400">
            Estimación con la fórmula de Epley. Las reps aproximadas son orientativas: varían según el ejercicio y tu nivel.
          </p>
        </>
      )}
    </div>
  )
}
