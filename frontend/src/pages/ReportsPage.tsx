import { useState } from 'react'
import { FileText, Download, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../services/api'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const errorMsg = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback

function ultimosMeses(n = 12) {
  const b = new Date(Date.now() - 5 * 3600e3)
  let y = b.getUTCFullYear(), m = b.getUTCMonth() + 1
  const out: { y: number; m: number; actual: boolean }[] = []
  for (let i = 0; i < n; i++) {
    out.push({ y, m, actual: i === 0 })
    m--
    if (m === 0) { m = 12; y-- }
  }
  return out
}

export default function ReportsPage() {
  const [ocupado, setOcupado] = useState<string | null>(null)

  const descargar = async (y: number, m: number) => {
    setOcupado(`d-${y}-${m}`)
    try {
      const r = await api.get('/reports/monthly', { params: { year: y, month: m }, responseType: 'blob' })
      const url = URL.createObjectURL(r.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte-${y}-${String(m).padStart(2, '0')}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch {
      toast.error('No se pudo generar el reporte')
    } finally {
      setOcupado(null)
    }
  }

  const telegram = async (y: number, m: number) => {
    setOcupado(`t-${y}-${m}`)
    try {
      await api.post('/reports/monthly/telegram', null, { params: { year: y, month: m } })
      toast.success('Reporte enviado a Telegram')
    } catch (e) {
      toast.error(errorMsg(e, 'No se pudo enviar el reporte'))
    } finally {
      setOcupado(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
          <FileText size={20} className="text-brand-600" />Reportes mensuales
        </h1>
        <p className="text-sm text-slate-500">
          Finanzas, presupuestos, deudas, hábitos y entrenos de cada mes en un PDF, con un comentario de la IA.
          El día 1 de cada mes te llega el del mes anterior por Telegram.
        </p>
      </div>

      <ul className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
        {ultimosMeses().map(({ y, m, actual }) => (
          <li key={`${y}-${m}`} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-800">{MESES[m - 1]} {y}</p>
              {actual && <p className="text-[11px] text-slate-400">Mes en curso (datos hasta hoy)</p>}
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => telegram(y, m)} disabled={ocupado !== null} aria-label="Enviar a Telegram"
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                <Send size={13} /><span className="hidden sm:inline">{ocupado === `t-${y}-${m}` ? 'Enviando...' : 'Telegram'}</span>
              </button>
              <button onClick={() => descargar(y, m)} disabled={ocupado !== null}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-brand-600 text-white font-semibold disabled:opacity-50">
                <Download size={13} />{ocupado === `d-${y}-${m}` ? 'Generando...' : 'PDF'}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-slate-400">Generar un reporte tarda unos segundos porque incluye el comentario de la IA.</p>
    </div>
  )
}
