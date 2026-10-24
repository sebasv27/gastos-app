// src/pages/DashboardPage.tsx — versión mejorada con widget unificado
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import { TrendingDown, TrendingUp, Wallet, PiggyBank, ArrowRight, CheckSquare, Flame, Clock, Beef, ChevronRight, Plus } from 'lucide-react'
import { dashboardApi, mealApi } from '../services/api'
import { fmtCOP, fmtShortDate } from '../utils/format'
import { useAuthStore } from '../store/authStore'
import AddTransactionModal from '../components/forms/AddTransactionModal'
import BudgetProgressBar   from '../components/ui/BudgetProgressBar'
import GoalCard            from '../components/ui/GoalCard'
import api from '../services/api'
import RecentTransactions from '../components/dashboard/RecentTransactions'

// APIs locales
const taskApi2   = { today: () => api.get('/tasks/today') }
const habitApi2  = { list:  () => api.get('/habits') }
const routineApi2 = { today: () => api.get('/routine/today') }
const mealApi2   = { today: () => api.get('/meals/today-summary') }

export default function DashboardPage() {
  const user = useAuthStore(s => s.user)
  const nav  = useNavigate()
  const now  = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year,  setYear]  = useState(now.getFullYear())
  const [showAdd, setShowAdd] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dashboard', month, year],
    queryFn: () => dashboardApi.getSummary(month, year).then(r => r.data)
  })

  const { data: tasksData }   = useQuery({ queryKey:['tasks-today'],   queryFn: () => taskApi2.today().then(r => r.data.data) })
  const { data: habitsData }  = useQuery({ queryKey:['habits'],        queryFn: () => habitApi2.list().then(r => r.data.data) })
  const { data: routineData } = useQuery({ queryKey:['routine-today'], queryFn: () => routineApi2.today().then(r => r.data.data) })
  const { data: mealsData }   = useQuery({ queryKey:['meals-today'],   queryFn: () => mealApi2.today().then(r => r.data.data) })

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const d = data
  const dailyData = (d?.dailyExpenses || []).map((e: { day: string; total: number }) => ({
    day: fmtShortDate(e.day), total: e.total
  }))
  const COLORS = (d?.byCategoryFull || []).map((c: { category: { color: string } }) => c.category.color)

  // Productividad
  const habits   = habitsData || []
  const tasks    = tasksData  || { pending:0, completed:0, tasks:[] }
  const routine  = routineData || []
  const habitsDone = habits.filter((h: {completedToday:boolean}) => h.completedToday).length

  const nowMins  = now.getHours()*60 + now.getMinutes()
  const nextBlock = routine.find((b: {startTime:string}) => {
    const [h,m] = b.startTime.split(':').map(Number); return h*60+m > nowMins
  })

  // Nutrición
  const totals  = mealsData?.totals
  const targets = mealsData?.targets
  const calPct  = targets?.calories ? Math.min(Math.round((totals?.calories||0)/targets.calories*100),100) : 0
  const protPct = targets?.proteinG ? Math.min(Math.round((totals?.proteinG||0)/targets.proteinG*100),100) : 0

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-dark">Hola, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {now.toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={month} onChange={e => setMonth(+e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
            {Array.from({length:12},(_,i) => (
              <option key={i+1} value={i+1}>
                {new Date(2024,i,1).toLocaleDateString('es-CO',{month:'long'})}
              </option>
            ))}
          </select>
          <select value={year} onChange={e => setYear(+e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
            {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => setShowAdd(true)}
            className="bg-brand-600 text-white rounded-lg px-4 py-1.5 text-sm font-medium hover:bg-brand-700 flex items-center gap-1.5">
            <Plus size={14} />Gasto
          </button>
        </div>
      </div>

      {/* ── WIDGET UNIFICADO ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        {/* Finanzas */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase">
              <Wallet size={12} />Finanzas
            </div>
            <button onClick={() => nav('/gastos')} className="text-brand-600 hover:text-brand-700">
              <ChevronRight size={14} />
            </button>
          </div>
          <p className="text-2xl font-bold text-dark">{fmtCOP(d?.summary?.totalExpenses||0)}</p>
          <p className="text-xs text-slate-400 mt-0.5">gastado este mes</p>
          <div className="mt-3 flex items-center gap-1.5">
            {(d?.summary?.balance||0) >= 0
              ? <TrendingUp size={13} className="text-brand-500" />
              : <TrendingDown size={13} className="text-red-500" />}
            <span className={`text-xs font-medium ${(d?.summary?.balance||0) >= 0 ? 'text-brand-600' : 'text-red-500'}`}>
              {fmtCOP(Math.abs(d?.summary?.balance||0))} {(d?.summary?.balance||0) >= 0 ? 'disponible' : 'en rojo'}
            </span>
          </div>
        </div>

        {/* Tareas + Hábitos */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase">
              <CheckSquare size={12} />Tareas
            </div>
            <button onClick={() => nav('/productividad/tareas')} className="text-brand-600">
              <ChevronRight size={14} />
            </button>
          </div>
          <p className="text-2xl font-bold text-dark">{tasks.completed}/{tasks.completed+tasks.pending}</p>
          <p className="text-xs text-slate-400 mt-0.5">completadas hoy</p>
          {tasks.tasks?.slice(0,2).map((t: {id:string;title:string}) => (
            <p key={t.id} className="text-xs text-slate-500 mt-1.5 truncate">• {t.title}</p>
          ))}
        </div>

        {/* Hábitos */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase">
              <Flame size={12} />Hábitos
            </div>
            <button onClick={() => nav('/productividad/habitos')} className="text-brand-600">
              <ChevronRight size={14} />
            </button>
          </div>
          <p className="text-2xl font-bold text-dark">{habitsDone}/{habits.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">completados hoy</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {habits.slice(0,4).map((h: {id:string;emoji:string;completedToday:boolean}) => (
              <span key={h.id} className={`text-lg ${h.completedToday ? '' : 'opacity-30'}`}>{h.emoji}</span>
            ))}
          </div>
        </div>

        {/* Nutrición */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase">
              <Beef size={12} />Nutrición
            </div>
            <button onClick={() => nav('/fitness/comidas')} className="text-brand-600">
              <ChevronRight size={14} />
            </button>
          </div>
          {targets ? (
            <>
              <p className="text-2xl font-bold text-dark">{Math.round(totals?.calories||0)}</p>
              <p className="text-xs text-slate-400 mt-0.5">kcal de {Math.round(targets.calories||0)}</p>
              <div className="mt-2 space-y-1.5">
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-0.5">
                    <span>Cal</span><span>{calPct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width:`${calPct}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-0.5">
                    <span>Prot</span><span>{protPct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full" style={{ width:`${protPct}%` }} />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400 mt-1">Configura tu perfil fitness</p>
          )}
        </div>
      </div>

      {/* Rutina del día */}
      {routine.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase">
              <Clock size={12} />Rutina de hoy
            </div>
            <button onClick={() => nav('/productividad/rutina')} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
              Ver todo <ChevronRight size={12} />
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {routine.slice(0,6).map((b: {id:string;emoji:string;title:string;startTime:string;endTime:string;color:string}) => {
              const [h,m] = b.startTime.split(':').map(Number)
              const isPast = h*60+m < nowMins
              return (
                <div key={b.id} className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs
                  ${isPast ? 'opacity-40 bg-slate-50 border-slate-100' : 'bg-white border-slate-200'}`}>
                  <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                  <div>
                    <p className="font-medium text-dark">{b.emoji} {b.title}</p>
                    <p className="text-slate-400">{b.startTime} - {b.endTime}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── FINANZAS ────────────────────────────────────────────────────── */}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label:'Ingresos', value: d?.summary?.totalIncome||0,   icon:<TrendingUp size={16} className="text-brand-500"/>,  color:'text-brand-600' },
          { label:'Gastos',   value: d?.summary?.totalExpenses||0, icon:<TrendingDown size={16} className="text-red-400"/>,   color:'text-red-600' },
          { label:'Balance',  value: d?.summary?.balance||0,       icon:<Wallet size={16} className="text-blue-400"/>,        color:(d?.summary?.balance||0)>=0?'text-brand-600':'text-red-600' },
          { label:'Ahorro',   value: 0,                             icon:<PiggyBank size={16} className="text-amber-400"/>,   color:'text-amber-600', isPct: true, pct: d?.summary?.savingsRate },
        ].map(({ label, value, icon, color, isPct, pct }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">{icon}<span className="text-xs text-slate-400">{label}</span></div>
            <p className={`text-lg font-bold ${color}`}>
              {isPct ? `${pct}%` : fmtCOP(value)}
            </p>
          </div>
        ))}
      </div>

      {/* Gráfica + Pie */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-dark mb-4">Gastos del mes</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={dailyData}>
              <XAxis dataKey="day" tick={{ fontSize:10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmtCOP(v)} />
              <Area type="monotone" dataKey="total" stroke="#0F6E56" fill="#E1F5EE" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-dark mb-4">Por categoría</h3>
          {d?.byCategoryFull?.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={d.byCategoryFull} dataKey="total" nameKey="category.name" cx="50%" cy="50%" outerRadius={55}>
                    {d.byCategoryFull.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtCOP(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {d.byCategoryFull.slice(0,4).map((c: {category:{name:string;color:string};total:number;pct:string}) => (
                  <div key={c.category.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.category.color }} />
                      <span className="text-slate-600 truncate max-w-20">{c.category.name}</span>
                    </div>
                    <span className="text-slate-400">{c.pct}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="text-slate-400 text-xs text-center mt-8">Sin gastos</p>}
        </div>
      </div>

      {/* Presupuestos */}
      {d?.budgets?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-dark">Presupuestos</h3>
            <button onClick={() => nav('/presupuestos')} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
              Ver todos <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-3">
            {d.budgets.slice(0,4).map((b: {id:string;category:{name:string;icon:string;color:string};spent:number;amount:number;alertAt:number}) => (
              <BudgetProgressBar key={b.id} budget={b as any} />
            ))}
          </div>
        </div>
      )}

      {/* Metas */}
      {d?.goals?.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-dark">Metas de ahorro</h3>
            <button onClick={() => nav('/metas')} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
              Ver todas <ArrowRight size={12} />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {d.goals.map((g: {id:string;name:string;targetAmount:number;savedAmount:number;icon:string;color:string;deadline?:string}) => (
              <GoalCard key={g.id} goal={g as any} />
            ))}
          </div>
        </div>
      )}

      {/* Transacciones recientes */}
              <RecentTransactions transactions={d?.recent ?? []} onAdd={() => setShowAdd(true)} />

      {showAdd && <AddTransactionModal onClose={() => { setShowAdd(false); refetch() }} onSuccess={() => { setShowAdd(false); refetch() }} />}
    </div>
  )
}
