// src/pages/ProductivityDashboardPage.tsx
// Mini-dashboard que muestra resumen de tareas + hábitos de hoy
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { CheckSquare, Flame, Clock, Timer, ChevronRight } from 'lucide-react'
import api from '../services/api'

export default function ProductivityDashboardPage() {
  const nav = useNavigate()
  const { data: tasks }   = useQuery({ queryKey:['tasks-today'],  queryFn: () => api.get('/tasks/today').then(r => r.data.data) })
  const { data: habits }  = useQuery({ queryKey:['habits'],       queryFn: () => api.get('/habits').then(r => r.data.data) })
  const { data: routine } = useQuery({ queryKey:['routine-today'],queryFn: () => api.get('/routine/today').then(r => r.data.data) })
  const { data: pStats }  = useQuery({ queryKey:['pomodoro-stats'],queryFn: () => api.get('/pomodoro/stats', { params: { days:1 } }).then(r => r.data.data) })

  const habitsArr    = habits    || []
  const tasksData    = tasks     || { pending:0, completed:0, overdue:0, tasks:[] }
  const routineArr   = routine   || []
  const habitsDone   = habitsArr.filter((h: {completedToday: boolean}) => h.completedToday).length
  const now = new Date()
  const nowMins = now.getHours()*60 + now.getMinutes()

  const nextBlock = routineArr.find((b: {startTime: string}) => {
    const [h,m] = b.startTime.split(':').map(Number); return h*60+m > nowMins
  })

  const sections = [
    { label:'Tareas', icon:<CheckSquare size={18} className="text-brand-600"/>, path:'/productividad/tareas',
      value: `${tasksData.completed}/${tasksData.completed+tasksData.pending}`, sub: tasksData.overdue > 0 ? `${tasksData.overdue} vencidas` : 'al día ✅' },
    { label:'Hábitos', icon:<Flame size={18} className="text-amber-500"/>, path:'/productividad/habitos',
      value: `${habitsDone}/${habitsArr.length}`, sub: habitsDone === habitsArr.length && habitsArr.length > 0 ? '¡Todo completado! 🎉' : 'completados hoy' },
    { label:'Rutina', icon:<Clock size={18} className="text-blue-500"/>, path:'/productividad/rutina',
      value: nextBlock ? nextBlock.startTime : '—', sub: nextBlock ? `${(nextBlock as {emoji:string; title:string}).emoji} ${(nextBlock as {emoji:string; title:string}).title}` : 'Sin más bloques hoy' },
    { label:'Pomodoro', icon:<Timer size={18} className="text-red-500"/>, path:'/productividad/pomodoro',
      value: pStats?.totalMinutes || 0, sub: `min enfocado hoy` },
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-dark">Productividad</h1>
        <p className="text-xs text-slate-400 mt-0.5">{now.toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' })}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {sections.map(s => (
          <button key={s.path} onClick={() => nav(s.path)}
            className="bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-brand-300 hover:shadow-sm transition-all group">
            <div className="flex items-center justify-between mb-3">
              {s.icon}
              <ChevronRight size={14} className="text-slate-300 group-hover:text-brand-400 transition-colors" />
            </div>
            <p className="text-2xl font-bold text-dark">{s.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.sub}</p>
            <p className="text-xs font-medium text-slate-500 mt-2">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Pending tasks today */}
      {tasksData.tasks?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-dark">Tareas de hoy</p>
            <button onClick={() => nav('/productividad/tareas')} className="text-xs text-brand-600 hover:underline">Ver todas</button>
          </div>
          <div className="space-y-2">
            {tasksData.tasks.map((t: {id:string;title:string;priority:string}) => {
              const colors: Record<string,string> = { URGENT:'text-red-600 bg-red-50', HIGH:'text-amber-600 bg-amber-50', MEDIUM:'text-blue-600 bg-blue-50', LOW:'text-slate-500 bg-slate-100' }
              return (
                <div key={t.id} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                  <p className="text-sm text-dark flex-1 truncate">{t.title}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${colors[t.priority]}`}>{t.priority === 'URGENT' ? '⚡' : t.priority === 'HIGH' ? '●' : ''}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
