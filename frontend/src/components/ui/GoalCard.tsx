// src/components/ui/GoalCard.tsx
import { Goal } from '../../types'
import { fmtCOP } from '../../utils/format'

export default function GoalCard({ goal }: { goal: Goal }) {
  const pct = goal.targetAmount > 0
    ? Math.min(Math.round((goal.savedAmount / goal.targetAmount) * 100), 100)
    : 0

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold mb-3"
        style={{ backgroundColor: goal.color }}
      >
        {goal.name[0]}
      </div>
      <p className="text-sm font-semibold text-dark leading-tight">{goal.name}</p>
      <p className="text-xs text-slate-400 mt-0.5 mb-3">{fmtCOP(goal.targetAmount)}</p>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: goal.color }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-400">
        <span>{fmtCOP(goal.savedAmount)}</span>
        <span className="font-semibold" style={{ color: goal.color }}>{pct}%</span>
      </div>
    </div>
  )
}
