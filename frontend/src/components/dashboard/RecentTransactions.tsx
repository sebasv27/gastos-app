// src/components/dashboard/RecentTransactions.tsx
import { Link } from 'react-router-dom'
import { ArrowRight, Plus } from 'lucide-react'
import CategoryIcon from '../CategoryIcon'
import { Transaction } from '../../types'

const fmtCOP = (n: number) =>
  '$ ' + Math.round(Math.abs(n)).toLocaleString('es-CO')

// Formatea la fecha en hora de Colombia. Si llega "YYYY-MM-DD" sin hora,
// se interpreta como fecha local para que no se corra un día atrás.
const fmtDate = (value: string) => {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value)
  return d.toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', timeZone: 'America/Bogota',
  }).replace('.', '')
}

interface Props {
  transactions: unknown
  limit?: number
  onAdd?: () => void
}

export default function RecentTransactions({ transactions, limit = 5, onAdd }: Props) {
  const t = transactions as any
  const list: Transaction[] = Array.isArray(t) ? t
    : Array.isArray(t?.data) ? t.data
    : Array.isArray(t?.transactions) ? t.transactions
    : Array.isArray(t?.recent) ? t.recent
    : []
  const items = list.slice(0, limit)

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-800">Recientes</h2>
        <Link
          to="/gastos"
          className="text-xs text-brand-600 font-medium flex items-center gap-1 hover:underline"
        >
          Ver todos <ArrowRight size={12} />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-slate-500">Aún no registras movimientos este mes.</p>
          {onAdd && (
            <button
              onClick={onAdd}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline"
            >
              <Plus size={13} /> Registrar un gasto
            </button>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map(t => {
            const isIncome = t.type === 'INCOME'
            return (
              <li key={t.id} className="flex items-center gap-3 py-3">
                <CategoryIcon
                  icon={t.category?.icon}
                  color={t.category?.color}
                  name={t.category?.name}
                />

                {/* min-w-0 permite que truncate funcione dentro de flex */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate first-letter:uppercase">
                    {t.description}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {fmtDate(t.date)}
                    {t.category?.name && <> &middot; {t.category.name}</>}
                  </p>
                </div>

                <span
                  className={`text-sm font-semibold tabular-nums shrink-0 ${
                    isIncome ? 'text-brand-600' : 'text-red-600'
                  }`}
                >
                  {isIncome ? '+' : '−'}{fmtCOP(t.amount)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
