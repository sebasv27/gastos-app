// src/pages/GoalsPage.tsx
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { goalApi } from '../services/api'
import { fmtCOP } from '../utils/format'
import { Goal } from '../types'

const COLORS = ['#0F6E56', '#185FA5', '#854F0B', '#A32D2D', '#534AB7', '#993556']

export default function GoalsPage() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', targetAmount: '', deadline: '' })

  const { data: goals, isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: () => goalApi.list().then(r => r.data.data)
  })

  const createGoal = async () => {
    if (!form.name || !form.targetAmount) {
      toast.error('Completa nombre y meta')
      return
    }
    try {
      await goalApi.create({
        ...form,
        targetAmount: parseFloat(form.targetAmount),
        color: COLORS[Math.floor(Math.random() * COLORS.length)]
      })
      toast.success('Meta creada ✓')
      setShowAdd(false)
      setForm({ name: '', targetAmount: '', deadline: '' })
      qc.invalidateQueries({ queryKey: ['goals'] })
    } catch {
      toast.error('Error al crear la meta')
    }
  }

  const updateProgress = async (goal: Goal, newAmount: number) => {
    try {
      await goalApi.update(goal.id, {
        savedAmount: newAmount,
        ...(newAmount >= goal.targetAmount && { status: 'COMPLETED' })
      })
      qc.invalidateQueries({ queryKey: ['goals'] })
      if (newAmount >= goal.targetAmount) toast.success(`🎉 ¡Meta "${goal.name}" completada!`)
    } catch {
      toast.error('Error al actualizar')
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-dark">Metas</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-brand-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-brand-700"
        >
          <Plus size={14} /> Nueva meta
        </button>
      </div>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Cargando...</p>
      ) : goals?.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-slate-400 text-sm">No tienes metas configuradas todavía</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {(goals || []).map((g: Goal) => {
            const pct = g.targetAmount > 0 ? Math.min(Math.round((g.savedAmount / g.targetAmount) * 100), 100) : 0
            return (
              <div key={g.id} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: g.color }}
                  >
                    {g.name[0]}
                  </div>
                  {g.status === 'COMPLETED' && (
                    <span className="text-xs bg-brand-50 text-brand-700 px-2 py-1 rounded-full font-medium">
                      Completada ✓
                    </span>
                  )}
                </div>
                <p className="font-semibold text-dark">{g.name}</p>
                <p className="text-xs text-slate-400 mt-0.5 mb-3">
                  Meta: {fmtCOP(g.targetAmount)}
                  {g.deadline && ` · ${new Date(g.deadline).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })}`}
                </p>

                <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: g.color }} />
                </div>
                <div className="flex justify-between text-xs text-slate-500 mb-3">
                  <span>{fmtCOP(g.savedAmount)}</span>
                  <span className="font-semibold" style={{ color: g.color }}>{pct}%</span>
                </div>

                <input
                  type="number"
                  defaultValue={g.savedAmount}
                  onBlur={e => {
                    const v = parseFloat(e.target.value)
                    if (!isNaN(v) && v !== g.savedAmount) updateProgress(g, v)
                  }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Actualizar monto ahorrado"
                />
              </div>
            )
          })}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-semibold text-dark">Nueva meta</h2>
              <button onClick={() => setShowAdd(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Nombre de la meta</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="ej. Pagar deuda total"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Monto objetivo ($)</label>
                <input
                  type="number"
                  value={form.targetAmount}
                  onChange={e => setForm(f => ({ ...f, targetAmount: e.target.value }))}
                  placeholder="5000000"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Fecha límite (opcional)</label>
                <input
                  type="date"
                  value={form.deadline}
                  onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 border border-slate-200 rounded-lg py-2.5 text-sm text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={createGoal} className="flex-1 bg-brand-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-brand-700">
                Crear meta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
