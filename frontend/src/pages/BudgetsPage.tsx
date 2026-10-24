// src/pages/BudgetsPage.tsx
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { budgetApi, categoryApi } from '../services/api'
import { fmtCOP } from '../utils/format'
import { Budget, Category } from '../types'
import BudgetProgressBar from '../components/ui/BudgetProgressBar'

export default function BudgetsPage() {
  const qc = useQueryClient()
  const now = new Date()
  const [month] = useState(now.getMonth() + 1)
  const [year]  = useState(now.getFullYear())
  const [editing, setEditing] = useState<string | null>(null)
  const [amount, setAmount]   = useState('')

  const { data: budgets, isLoading } = useQuery({
    queryKey: ['budgets', month, year],
    queryFn: () => budgetApi.list(month, year).then(r => r.data.data)
  })

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryApi.list().then(r => r.data.data)
  })

  const budgetedIds = new Set((budgets || []).map((b: Budget) => b.categoryId))
  const unbudgeted  = (categories || []).filter((c: Category) => !budgetedIds.has(c.id))

  const saveBudget = async (categoryId: string) => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Ingresa un monto válido')
      return
    }
    try {
      await budgetApi.upsert({ categoryId, amount: parseFloat(amount), month, year })
      toast.success('Presupuesto guardado')
      setEditing(null)
      setAmount('')
      qc.invalidateQueries({ queryKey: ['budgets'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    } catch {
      toast.error('Error al guardar')
    }
  }

  const totalBudget = (budgets || []).reduce((s: number, b: Budget) => s + b.amount, 0)
  const totalSpent  = (budgets || []).reduce((s: number, b: Budget) => s + b.spent, 0)

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-dark">Presupuestos</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {now.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Summary bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500">Total presupuestado</p>
          <p className="text-lg font-bold text-dark">{fmtCOP(totalBudget)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Gastado</p>
          <p className={`text-lg font-bold ${totalSpent > totalBudget ? 'text-red-600' : 'text-brand-600'}`}>
            {fmtCOP(totalSpent)}
          </p>
        </div>
      </div>

      {/* Active budgets */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
        <h2 className="text-sm font-semibold text-dark">Tus presupuestos</h2>
        {isLoading ? (
          <p className="text-slate-400 text-sm">Cargando...</p>
        ) : budgets?.length === 0 ? (
          <p className="text-slate-400 text-sm">No has configurado presupuestos aún</p>
        ) : (
          (budgets || []).map((b: Budget) => (
            <BudgetProgressBar key={b.id} budget={b} />
          ))
        )}
      </div>

      {/* Add budget for unbudgeted categories */}
      {unbudgeted.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-dark mb-3">Configurar nuevo presupuesto</h2>
          <div className="space-y-2">
            {unbudgeted.map((c: Category) => (
              <div key={c.id} className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: c.color }}
                >
                  {c.name[0]}
                </div>
                <span className="text-sm text-slate-700 flex-1">{c.name}</span>
                {editing === c.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      autoFocus
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="Monto"
                      className="w-28 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <button
                      onClick={() => saveBudget(c.id)}
                      className="bg-brand-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-brand-700"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => { setEditing(null); setAmount('') }}
                      className="text-slate-400 text-xs px-2"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditing(c.id)}
                    className="text-brand-600 text-xs font-medium hover:underline"
                  >
                    + Asignar presupuesto
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
