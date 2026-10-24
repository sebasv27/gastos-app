// src/components/ui/BudgetProgressBar.tsx
import { Budget } from '../../types'
import { fmtCOP } from '../../utils/format'

export default function BudgetProgressBar({ budget }: { budget: Budget }) {
  const p   = budget.amount > 0 ? budget.spent / budget.amount : 0
  const pct = Math.min(Math.round(p * 100), 100)
  const color = p >= 1 ? '#A32D2D' : p >= 0.8 ? '#854F0B' : '#0F6E56'

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-medium text-slate-700">{budget.category?.name}</span>
        <span style={{ color }} className="font-semibold">{pct}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-400 mt-1">
        <span>{fmtCOP(budget.spent)}</span>
        <span>{fmtCOP(budget.amount)}</span>
      </div>
    </div>
  )
}
