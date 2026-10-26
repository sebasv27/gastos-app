import { useEffect, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, X, Landmark, HandCoins, Trash2, Pencil, ChevronDown, ChevronUp,
  Sparkles, Send, TrendingDown, AlertTriangle, Lightbulb, Scissors,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../services/api'

type Direction = 'I_OWE' | 'OWED_TO_ME'
type DebtType = 'CREDIT_CARD' | 'LOAN' | 'PERSONAL' | 'MORTGAGE' | 'VEHICLE' | 'OTHER'

interface Payment { id: string; amount: number; date: string; notes?: string | null }
interface Debt {
  id: string; direction: Direction; type: DebtType; name: string; counterparty?: string | null
  principal: number; balance: number; interestRate: number; rateType: 'EA' | 'MONTHLY'
  minPayment?: number | null; dueDay?: number | null; notes?: string | null
  isPaid: boolean; payments: Payment[]; monthlyInterest: number
}
interface Summary { iOwe: number; owedToMe: number; monthlyMin: number; monthlyInterest: number }
interface Sim {
  months: number | null; totalInterest: number; totalPaid: number; monthlyBudget: number
  order: { id: string; name: string }[]; feasible: boolean
}
interface Plan { avalanche: Sim; snowball: Sim; minimumOnly: Sim }
interface AdviceAI {
  resumen?: string; estrategia?: string; porQue?: string; prioridad?: string
  recortes?: { categoria: string; ahorroMensual: number; como: string }[]
  consejos?: string[]; alertas?: string[]
}
interface Advice { id: string; createdAt: string; content: { ai: AdviceAI; plan?: { extra: number } } }

const TIPOS: Record<DebtType, string> = {
  CREDIT_CARD: 'Tarjeta de crédito', LOAN: 'Crédito bancario', PERSONAL: 'Préstamo personal',
  MORTGAGE: 'Hipotecario', VEHICLE: 'Vehículo', OTHER: 'Otro',
}

const fmt = (n: number) => `$ ${Math.round(n || 0).toLocaleString('es-CO')}`
const moneyInput = (v: string) => { const d = v.replace(/\D/g, ''); return d ? Number(d).toLocaleString('es-CO') : '' }
const parseMoney = (v: string) => Number(v.replace(/\D/g, '')) || 0
const hoyISO = () => new Date().toLocaleDateString('en-CA')
const fmtFecha = (d: string) =>
  new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' }).replace('.', '')
const duracion = (m: number | null) => {
  if (m === null) return 'Nunca: la cuota no cubre los intereses'
  const a = Math.floor(m / 12), r = m % 12
  return [a ? `${a} año${a > 1 ? 's' : ''}` : '', r ? `${r} mes${r > 1 ? 'es' : ''}` : ''].filter(Boolean).join(' y ') || '0 meses'
}
const errorMsg = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback

const inputCls = 'w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-600/30'
const labelCls = 'block text-xs text-slate-500'

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg max-h-[92vh] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden shadow-xl"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto p-5 space-y-3">{children}</div>
      </div>
    </div>
  )
}

function DebtForm({ debt, defaultDirection, onDone }: { debt: Debt | null; defaultDirection: Direction; onDone: () => void }) {
  const [direction, setDirection] = useState<Direction>(debt?.direction ?? defaultDirection)
  const [name, setName] = useState(debt?.name ?? '')
  const [counterparty, setCounterparty] = useState(debt?.counterparty ?? '')
  const [type, setType] = useState<DebtType>(debt?.type ?? (defaultDirection === 'OWED_TO_ME' ? 'PERSONAL' : 'CREDIT_CARD'))
  const [principal, setPrincipal] = useState(debt ? moneyInput(String(Math.round(debt.principal))) : '')
  const [balance, setBalance] = useState(debt ? moneyInput(String(Math.round(debt.balance))) : '')
  const [rate, setRate] = useState(debt?.interestRate ? String(debt.interestRate).replace('.', ',') : '')
  const [rateType, setRateType] = useState<'EA' | 'MONTHLY'>(debt?.rateType ?? 'EA')
  const [minPayment, setMinPayment] = useState(debt?.minPayment ? moneyInput(String(Math.round(debt.minPayment))) : '')
  const [dueDay, setDueDay] = useState(debt?.dueDay ? String(debt.dueDay) : '')
  const [notes, setNotes] = useState(debt?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const debo = direction === 'I_OWE'

  const guardar = async () => {
    if (!name.trim() || !parseMoney(principal)) { toast.error('Nombre y monto son obligatorios'); return }
    const body = {
      direction, type, name: name.trim(), counterparty: counterparty.trim() || null,
      principal: parseMoney(principal),
      balance: balance ? parseMoney(balance) : parseMoney(principal),
      interestRate: debo && rate ? parseFloat(rate.replace(',', '.')) || 0 : 0,
      rateType,
      minPayment: debo && minPayment ? parseMoney(minPayment) : null,
      dueDay: dueDay ? parseInt(dueDay) : null,
      notes: notes.trim() || null,
    }
    setSaving(true)
    try {
      if (debt) await api.put(`/debts/${debt.id}`, body)
      else await api.post('/debts', body)
      toast.success(debt ? 'Cambios guardados' : 'Registrado')
      onDone()
    } catch (e) {
      toast.error(errorMsg(e, 'No se pudo guardar'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {!debt && (
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
          {(['I_OWE', 'OWED_TO_ME'] as Direction[]).map(d => (
            <button key={d}
              onClick={() => { setDirection(d); setType(d === 'OWED_TO_ME' ? 'PERSONAL' : 'CREDIT_CARD') }}
              className={`py-2 rounded-lg text-sm font-medium ${direction === d ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>
              {d === 'I_OWE' ? 'Yo debo' : 'Me deben'}
            </button>
          ))}
        </div>
      )}

      <label className={labelCls}>{debo ? 'Nombre de la deuda' : 'Descripción del préstamo'}
        <input value={name} onChange={e => setName(e.target.value)}
               placeholder={debo ? 'ej. Tarjeta Visa' : 'ej. Préstamo para la moto'} className={inputCls} />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className={labelCls}>{debo ? 'Acreedor' : 'Quién te debe'}
          <input value={counterparty} onChange={e => setCounterparty(e.target.value)}
                 placeholder={debo ? 'Banco o persona' : 'Nombre'} className={inputCls} />
        </label>
        <label className={labelCls}>Tipo
          <select value={type} onChange={e => setType(e.target.value as DebtType)} className={inputCls}>
            {(Object.keys(TIPOS) as DebtType[]).map(t => <option key={t} value={t}>{TIPOS[t]}</option>)}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className={labelCls}>Monto original
          <input inputMode="numeric" value={principal} onChange={e => setPrincipal(moneyInput(e.target.value))}
                 placeholder="0" className={inputCls} />
        </label>
        <label className={labelCls}>Saldo actual
          <input inputMode="numeric" value={balance} onChange={e => setBalance(moneyInput(e.target.value))}
                 placeholder={principal || 'Igual al monto'} className={inputCls} />
        </label>
      </div>

      {debo && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <label className={labelCls}>Tasa de interés (%)
              <input inputMode="decimal" value={rate} onChange={e => setRate(e.target.value.replace(/[^\d,.]/g, ''))}
                     placeholder="ej. 28,5" className={inputCls} />
            </label>
            <label className={labelCls}>Tipo de tasa
              <select value={rateType} onChange={e => setRateType(e.target.value as 'EA' | 'MONTHLY')} className={inputCls}>
                <option value="EA">Efectiva anual (EA)</option>
                <option value="MONTHLY">Mensual</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className={labelCls}>Cuota mínima
              <input inputMode="numeric" value={minPayment} onChange={e => setMinPayment(moneyInput(e.target.value))}
                     placeholder="0" className={inputCls} />
            </label>
            <label className={labelCls}>Día de pago
              <input inputMode="numeric" value={dueDay} onChange={e => setDueDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
                     placeholder="1 a 31" className={inputCls} />
            </label>
          </div>
          <p className="text-[11px] text-slate-400">
            La tasa aparece en tu extracto. Si no pones cuota mínima, el plan de pago asume el 3 % del saldo.
          </p>
        </>
      )}

      <label className={labelCls}>Notas (opcional)
        <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} />
      </label>

      <button onClick={guardar} disabled={saving}
              className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50">
        {saving ? 'Guardando...' : debt ? 'Guardar cambios' : 'Registrar'}
      </button>
    </>
  )
}

function PaymentForm({ debt, onDone }: { debt: Debt; onDone: () => void }) {
  const [amount, setAmount] = useState(
    debt.minPayment ? moneyInput(String(Math.round(Math.min(debt.minPayment, debt.balance)))) : '')
  const [date, setDate] = useState(hoyISO())
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const debo = debt.direction === 'I_OWE'

  const guardar = async () => {
    const monto = parseMoney(amount)
    if (!monto) { toast.error('Ingresa el monto del abono'); return }
    setSaving(true)
    try {
      await api.post(`/debts/${debt.id}/payments`, { amount: monto, date: `${date}T12:00:00-05:00`, notes: notes.trim() || null })
      toast.success(monto >= debt.balance ? '🎉 ¡Saldada por completo!' : 'Abono registrado')
      onDone()
    } catch (e) {
      toast.error(errorMsg(e, 'No se pudo registrar el abono'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="bg-slate-50 rounded-xl p-3">
        <p className="text-xs text-slate-500">Saldo actual de {debt.name}</p>
        <p className="text-lg font-bold text-slate-800">{fmt(debt.balance)}</p>
      </div>
      <label className={labelCls}>Monto del abono
        <input inputMode="numeric" value={amount} onChange={e => setAmount(moneyInput(e.target.value))}
               placeholder="0" className={inputCls} autoFocus />
      </label>
      <div className="flex gap-2">
        {debt.minPayment ? (
          <button onClick={() => setAmount(moneyInput(String(Math.round(Math.min(debt.minPayment!, debt.balance)))))}
                  className="text-xs px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50">
            Cuota mínima
          </button>
        ) : null}
        <button onClick={() => setAmount(moneyInput(String(Math.round(debt.balance))))}
                className="text-xs px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50">
          Saldo total
        </button>
      </div>
      <label className={labelCls}>Fecha
        <input type="date" value={date} max={hoyISO()} onChange={e => setDate(e.target.value)} className={inputCls} />
      </label>
      <label className={labelCls}>Nota (opcional)
        <input value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} />
      </label>
      <p className="text-[11px] text-slate-400">
        {debo ? 'Se registrará como gasto en la categoría Deudas.' : 'Se registrará como ingreso en la categoría Préstamos.'}
      </p>
      <button onClick={guardar} disabled={saving}
              className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50">
        {saving ? 'Guardando...' : 'Registrar abono'}
      </button>
    </>
  )
}

function DebtCard({ d, onPay, onEdit, onDelete, onDeletePayment }: {
  d: Debt; onPay: () => void; onEdit: () => void; onDelete: () => void; onDeletePayment: (p: Payment) => void
}) {
  const [open, setOpen] = useState(false)
  const debo = d.direction === 'I_OWE'
  const avance = d.principal > 0 ? Math.min(100, Math.max(0, Math.round((1 - d.balance / d.principal) * 100))) : 0

  return (
    <div className={`bg-white border border-slate-200 rounded-2xl p-4 ${d.isPaid ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">
            {d.name}
            {d.isPaid && <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 align-middle">Saldada</span>}
          </p>
          <p className="text-xs text-slate-400 truncate">{TIPOS[d.type]}{d.counterparty ? ` · ${d.counterparty}` : ''}</p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-base font-bold tabular-nums ${debo ? 'text-red-600' : 'text-blue-600'}`}>{fmt(d.balance)}</p>
          <p className="text-[11px] text-slate-400">de {fmt(d.principal)}</p>
        </div>
      </div>

      <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-brand-600 rounded-full" style={{ width: `${avance}%` }} />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-slate-500">
        <span>{avance}% {debo ? 'pagado' : 'recuperado'}</span>
        {debo && d.interestRate > 0 && <span>{String(d.interestRate).replace('.', ',')}% {d.rateType === 'EA' ? 'EA' : 'mensual'}</span>}
        {debo && d.monthlyInterest > 0 && <span>~{fmt(d.monthlyInterest)} de interés al mes</span>}
        {d.minPayment ? <span>Cuota {fmt(d.minPayment)}</span> : null}
        {d.dueDay ? <span>Paga el día {d.dueDay}</span> : null}
      </div>

      <div className="flex items-center gap-2 mt-3">
        {!d.isPaid && (
          <button onClick={onPay} className="flex-1 py-2 rounded-xl bg-brand-600 text-white text-xs font-semibold">
            {debo ? 'Registrar abono' : 'Registrar pago recibido'}
          </button>
        )}
        <button onClick={onEdit} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Editar">
          <Pencil size={14} />
        </button>
        <button onClick={onDelete} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-red-600 hover:bg-red-50" aria-label="Eliminar">
          <Trash2 size={14} />
        </button>
        {d.payments.length > 0 && (
          <button onClick={() => setOpen(o => !o)} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
                  aria-label="Ver abonos">
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {open && (
        <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
          {d.payments.map(p => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-xs">
              <span className="text-slate-500 truncate">{fmtFecha(p.date)}{p.notes ? ` · ${p.notes}` : ''}</span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="font-medium text-slate-700 tabular-nums">{fmt(p.amount)}</span>
                <button onClick={() => onDeletePayment(p)} className="text-slate-300 hover:text-red-500" aria-label="Eliminar abono">
                  <Trash2 size={13} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function PlanSection() {
  const [extraTxt, setExtraTxt] = useState('')
  const [extra, setExtra] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setExtra(parseMoney(extraTxt)), 400)
    return () => clearTimeout(t)
  }, [extraTxt])

  const { data } = useQuery({
    queryKey: ['debt-plan', extra],
    queryFn: () => api.get('/debts/plan', { params: { extra } }).then(r => r.data.data as Plan),
  })
  if (!data || data.minimumOnly.order.length === 0) return null

  const mejor: 'avalanche' | 'snowball' = data.avalanche.totalInterest <= data.snowball.totalInterest ? 'avalanche' : 'snowball'
  const ahorro = data.minimumOnly.feasible && data[mejor].feasible
    ? data.minimumOnly.totalInterest - data[mejor].totalInterest : null

  const tarjeta = (key: 'avalanche' | 'snowball', titulo: string, desc: string) => {
    const s = data[key]
    return (
      <div className={`rounded-2xl border p-4 ${mejor === key ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800">{titulo}</p>
          {mejor === key && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-600 text-white">Menos intereses</span>}
        </div>
        <p className="text-[11px] text-slate-400">{desc}</p>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div><p className="text-[11px] text-slate-400">Tiempo</p><p className="text-sm font-semibold text-slate-800">{duracion(s.months)}</p></div>
          <div><p className="text-[11px] text-slate-400">Intereses</p><p className="text-sm font-semibold text-slate-800">{fmt(s.totalInterest)}</p></div>
        </div>
        <p className="text-[11px] text-slate-500 mt-2">Orden: {s.order.map(o => o.name).join(' → ')}</p>
      </div>
    )
  }

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5"><TrendingDown size={16} className="text-brand-600" />Plan para salir de deudas</h2>
        <p className="text-xs text-slate-400">Cuotas mínimas más lo que puedas abonar de extra cada mes.</p>
      </div>
      <label className={labelCls}>¿Cuánto extra puedes abonar al mes?
        <input inputMode="numeric" value={extraTxt} onChange={e => setExtraTxt(moneyInput(e.target.value))}
               placeholder="0" className={inputCls} />
      </label>
      <p className="text-xs text-slate-500">Pagarías <b>{fmt(data.avalanche.monthlyBudget)}</b> al mes en total.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {tarjeta('avalanche', 'Avalancha', 'Primero la deuda con la tasa más alta')}
        {tarjeta('snowball', 'Bola de nieve', 'Primero la deuda más pequeña')}
      </div>
      <p className="text-xs text-slate-500">
        Pagando solo los mínimos: {duracion(data.minimumOnly.months)}
        {data.minimumOnly.feasible ? ` y ${fmt(data.minimumOnly.totalInterest)} en intereses` : ''}.
        {ahorro && ahorro > 0 ? <> Con este plan te ahorras <b className="text-emerald-600">{fmt(ahorro)}</b>.</> : null}
      </p>
    </section>
  )
}

function AdviceSection() {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const { data: advice } = useQuery({
    queryKey: ['debt-advice'],
    queryFn: () => api.get('/debts/advice/latest').then(r => r.data.data as Advice | null),
  })

  const analizar = async () => {
    setLoading(true)
    try {
      await api.post('/debts/advice')
      await qc.invalidateQueries({ queryKey: ['debt-advice'] })
    } catch (e) {
      toast.error(errorMsg(e, 'No se pudo generar el análisis'))
    } finally {
      setLoading(false)
    }
  }
  const telegram = async () => {
    setSending(true)
    try {
      await api.post('/debts/advice/telegram')
      toast.success('Resumen enviado a Telegram')
    } catch (e) {
      toast.error(errorMsg(e, 'No se pudo enviar'))
    } finally {
      setSending(false)
    }
  }

  const ai = advice?.content?.ai

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
          <Sparkles size={16} className="text-violet-500" />Análisis con IA
        </h2>
        <div className="flex gap-2">
          <button onClick={telegram} disabled={sending}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <Send size={13} />{sending ? 'Enviando...' : 'Enviar a Telegram'}
          </button>
          <button onClick={analizar} disabled={loading}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-700 disabled:opacity-50">
            <Sparkles size={13} />{loading ? 'Analizando...' : ai ? 'Analizar de nuevo' : 'Analizar mis finanzas'}
          </button>
        </div>
      </div>

      {!ai ? (
        <p className="text-sm text-slate-500">
          La IA revisa tus ingresos y gastos de los últimos 3 meses junto con tus deudas, y te sugiere un plan:
          qué deuda atacar primero, dónde recortar y qué riesgos tienes.
        </p>
      ) : (
        <>
          <p className="text-[11px] text-slate-400">Análisis del {fmtFecha(advice!.createdAt)}</p>
          {ai.resumen && <p className="text-sm text-slate-700">{ai.resumen}</p>}

          {ai.alertas && ai.alertas.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
              {ai.alertas.map((a, i) => (
                <p key={i} className="text-xs text-amber-800 flex gap-1.5"><AlertTriangle size={13} className="shrink-0 mt-0.5" />{a}</p>
              ))}
            </div>
          )}

          {ai.prioridad && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <TrendingDown size={13} />Prioridad{ai.estrategia ? ` · estrategia ${ai.estrategia}` : ''}
              </p>
              <p className="text-sm text-slate-600 mt-1">{ai.prioridad}</p>
              {ai.porQue && <p className="text-xs text-slate-400 mt-1">{ai.porQue}</p>}
            </div>
          )}

          {ai.recortes && ai.recortes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1"><Scissors size={13} />Dónde recortar</p>
              <ul className="divide-y divide-slate-100">
                {ai.recortes.map((r, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 py-2 text-sm">
                    <span className="text-slate-600"><b className="text-slate-800">{r.categoria}:</b> {r.como}</span>
                    <span className="shrink-0 text-emerald-600 font-medium text-xs">+{fmt(r.ahorroMensual)}/mes</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ai.consejos && ai.consejos.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1"><Lightbulb size={13} />Consejos</p>
              <ul className="list-disc pl-5 space-y-1 text-sm text-slate-600">
                {ai.consejos.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}
        </>
      )}

      <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-3">
        Sugerencias generadas automáticamente a partir de tus datos; no son asesoría financiera profesional.
        Para decisiones como refinanciar o comprar cartera, compara opciones con tu banco o un asesor.
        A la IA solo se envían montos y tipos de deuda, nunca nombres.
      </p>
    </section>
  )
}

export default function DebtsPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Direction>('I_OWE')
  const [form, setForm] = useState<{ debt: Debt | null } | null>(null)
  const [paying, setPaying] = useState<Debt | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['debts'],
    queryFn: () => api.get('/debts').then(r => r.data as { data: Debt[]; summary: Summary }),
  })

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ['debts'] })
    qc.invalidateQueries({ queryKey: ['debt-plan'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const borrar = async (d: Debt) => {
    const n = d.payments.length
    if (!confirm(`¿Eliminar "${d.name}"?${n ? ` También se borrarán sus ${n} abono(s) y los movimientos asociados.` : ''}`)) return
    try { await api.delete(`/debts/${d.id}`); toast.success('Eliminada'); refrescar() }
    catch (e) { toast.error(errorMsg(e, 'No se pudo eliminar')) }
  }
  const borrarAbono = async (p: Payment) => {
    if (!confirm(`¿Eliminar el abono de ${fmt(p.amount)}? También se borrará su movimiento.`)) return
    try { await api.delete(`/debts/payments/${p.id}`); toast.success('Abono eliminado'); refrescar() }
    catch (e) { toast.error(errorMsg(e, 'No se pudo eliminar')) }
  }

  const debts = data?.data ?? []
  const s = data?.summary
  const lista = debts.filter(d => d.direction === tab)

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 flex items-center gap-2"><Landmark size={20} className="text-brand-600" />Deudas y préstamos</h1>
          <p className="text-sm text-slate-500">Lo que debes, lo que te deben y un plan para ponerte al día</p>
        </div>
        <button onClick={() => setForm({ debt: null })}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold shrink-0">
          <Plus size={16} />Nueva
        </button>
      </div>

      {s && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ['Debes', fmt(s.iOwe), 'text-red-600'],
            ['Te deben', fmt(s.owedToMe), 'text-blue-600'],
            ['Cuotas al mes', fmt(s.monthlyMin), 'text-slate-800'],
            ['Intereses al mes', `~${fmt(s.monthlyInterest)}`, 'text-amber-600'],
          ].map(([l, v, c]) => (
            <div key={l} className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-xs text-slate-400">{l}</p>
              <p className={`text-lg font-bold tabular-nums mt-0.5 ${c}`}>{v}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
        {(['I_OWE', 'OWED_TO_ME'] as Direction[]).map(d => (
          <button key={d} onClick={() => setTab(d)}
                  className={`py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 ${tab === d ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>
            {d === 'I_OWE' ? <Landmark size={14} /> : <HandCoins size={14} />}
            {d === 'I_OWE' ? 'Lo que debo' : 'Lo que me deben'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="h-28 bg-white border border-slate-200 rounded-2xl animate-pulse" />
      ) : lista.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <p className="text-sm text-slate-600">{tab === 'I_OWE' ? 'No tienes deudas registradas.' : 'Nadie te debe dinero por ahora.'}</p>
          <button onClick={() => setForm({ debt: null })} className="mt-2 text-sm font-medium text-brand-600 hover:underline">
            {tab === 'I_OWE' ? 'Registrar una deuda' : 'Registrar un préstamo'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {lista.map(d => (
            <DebtCard key={d.id} d={d}
              onPay={() => setPaying(d)} onEdit={() => setForm({ debt: d })}
              onDelete={() => borrar(d)} onDeletePayment={borrarAbono} />
          ))}
        </div>
      )}

      {tab === 'I_OWE' && <PlanSection />}
      <AdviceSection />

      {form && (
        <Modal title={form.debt ? 'Editar' : tab === 'I_OWE' ? 'Nueva deuda' : 'Nuevo préstamo'} onClose={() => setForm(null)}>
          <DebtForm debt={form.debt} defaultDirection={tab} onDone={() => { setForm(null); refrescar() }} />
        </Modal>
      )}
      {paying && (
        <Modal title={paying.direction === 'I_OWE' ? 'Registrar abono' : 'Registrar pago recibido'} onClose={() => setPaying(null)}>
          <PaymentForm debt={paying} onDone={() => { setPaying(null); refrescar() }} />
        </Modal>
      )}
    </div>
  )
}
