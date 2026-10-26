// src/pages/AlertsPage.tsx  —  Fase 2
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, AlertTriangle, TrendingDown, Trophy, BarChart2, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { alertApi } from '../services/api'
import { Alert } from '../types'

const ALERT_META: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  BUDGET_WARNING:  { icon: <AlertTriangle size={16} />, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  BUDGET_EXCEEDED: { icon: <TrendingDown size={16} />,  color: 'text-red-600',   bg: 'bg-red-50 border-red-200' },
  GOAL_REACHED:    { icon: <Trophy size={16} />,         color: 'text-brand-600', bg: 'bg-brand-50 border-brand-200' },
  WEEKLY_SUMMARY:  { icon: <BarChart2 size={16} />,      color: 'text-blue-600',  bg: 'bg-blue-50 border-blue-200' },
  UNUSUAL_EXPENSE: { icon: <Zap size={16} />,            color: 'text-purple-600',bg: 'bg-purple-50 border-purple-200' },
}

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60)   return 'Ahora mismo'
  if (diff < 3600) return `Hace ${Math.round(diff/60)} min`
  if (diff < 86400)return `Hace ${Math.round(diff/3600)} h`
  return `Hace ${Math.round(diff/86400)} días`
}

export default function AlertsPage() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => alertApi.list().then(r => r.data),
    refetchInterval: 30_000,
  })

  const alerts: Alert[] = data?.data || []
  const unread = alerts.filter(a => !a.isRead).length

  const markRead = async (id: string) => {
    try {
      await alertApi.markRead(id)
      qc.invalidateQueries({ queryKey: ['alerts'] })
    } catch { toast.error('Error') }
  }

  const markAllRead = async () => {
    try {
      await alertApi.markAllRead()
      toast.success('Todas marcadas como leídas')
      qc.invalidateQueries({ queryKey: ['alerts'] })
    } catch { toast.error('Error') }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-dark">Alertas</h1>
          {unread > 0 && (
            <p className="text-xs text-slate-400 mt-0.5">{unread} sin leer</p>
          )}
        </div>
        {unread > 0 && (
          <button onClick={markAllRead}
            className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium">
            <CheckCheck size={15} /> Marcar todas
          </button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="py-16 text-center">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="py-16 text-center">
          <Bell size={36} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Sin alertas por el momento</p>
          <p className="text-slate-300 text-xs mt-1">Te avisaremos cuando llegues al 80% de un presupuesto</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map(a => {
            const meta = ALERT_META[a.type] || ALERT_META.WEEKLY_SUMMARY
            return (
              <div key={a.id}
                onClick={() => !a.isRead && markRead(a.id)}
                className={`flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer
                  ${a.isRead
                    ? 'bg-white border-slate-100 opacity-80 hover:opacity-100'
                    : `${meta.bg} hover:shadow-sm`}`}
              >
                <div className={`mt-0.5 shrink-0 ${meta.color}`}>{meta.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${a.isRead ? 'text-slate-500' : 'text-dark font-medium'}`}>
                    {a.message}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{timeAgo(a.createdAt)}</p>
                </div>
                {!a.isRead && (
                  <div className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 shrink-0" />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
