// src/pages/StatsPage.tsx  —  Fase 2
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid
} from 'recharts'
import { TrendingDown, TrendingUp, Award, AlertTriangle } from 'lucide-react'
import { dashboardApi } from '../services/api'
import { fmtCOP } from '../utils/format'

interface TrendItem { label: string; total: number }
interface CategoryItem { category: { name: string; color: string }; total: number; pct: string }

const RADIAN = Math.PI / 180
const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, pct }: {
  cx: number; cy: number; midAngle: number
  innerRadius: number; outerRadius: number; pct: string
}) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return parseFloat(pct) > 5 ? (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {pct}%
    </text>
  ) : null
}

export default function StatsPage() {
  const now = new Date()

  const { data: dash } = useQuery({
    queryKey: ['dashboard', now.getMonth() + 1, now.getFullYear()],
    queryFn:  () => dashboardApi.getSummary(now.getMonth() + 1, now.getFullYear()).then(r => r.data)
  })

  const { data: trendData, isLoading: trendLoading } = useQuery({
    queryKey: ['trend'],
    queryFn:  () => dashboardApi.getTrend().then(r => r.data)
  })

  const trend: TrendItem[] = trendData?.data || []
  const cats: CategoryItem[] = dash?.byCategoryFull || []
  const summary = dash?.summary

  // Insights automáticos
  const insights: { icon: React.ReactNode; text: string; color: string }[] = []
  if (summary) {
    const savingsRate = parseFloat(summary.savingsRate)
    if (savingsRate >= 10)
      insights.push({ icon: <Award size={15} />, text: `Ahorrando el ${savingsRate}% de tus ingresos este mes. ¡Vas bien!`, color: 'text-brand-600 bg-brand-50 border-brand-200' })
    else if (savingsRate < 0)
      insights.push({ icon: <AlertTriangle size={15} />, text: `Gastaste más de lo que entraste este mes (${fmtCOP(Math.abs(summary.balance))}).`, color: 'text-red-600 bg-red-50 border-red-200' })

    const topCat = cats[0]
    if (topCat)
      insights.push({ icon: <TrendingDown size={15} />, text: `Tu mayor gasto fue ${topCat.category.name} con ${fmtCOP(topCat.total)} (${topCat.pct}% del total).`, color: 'text-amber-600 bg-amber-50 border-amber-200' })

    if (trend.length >= 2) {
      const last = trend[trend.length - 1].total
      const prev = trend[trend.length - 2].total
      const diff = prev > 0 ? ((last - prev) / prev) * 100 : 0
      if (diff > 15)
        insights.push({ icon: <TrendingUp size={15} />, text: `Gastaste ${Math.round(diff)}% más que el mes pasado.`, color: 'text-red-600 bg-red-50 border-red-200' })
      else if (diff < -10)
        insights.push({ icon: <TrendingDown size={15} />, text: `Redujiste tus gastos un ${Math.abs(Math.round(diff))}% vs el mes pasado. ¡Excelente!`, color: 'text-brand-600 bg-brand-50 border-brand-200' })
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold text-dark">Estadísticas</h1>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {insights.map((ins, i) => (
            <div key={i} className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${ins.color}`}>
              <span className="mt-0.5 shrink-0">{ins.icon}</span>
              <p>{ins.text}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* 6-month trend bar chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-dark mb-4">Tendencia 6 meses</h2>
          {trendLoading ? (
            <div className="h-52 flex items-center justify-center text-slate-300">Cargando...</div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={trend} barSize={28}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={48} />
                <Tooltip formatter={(v: number) => fmtCOP(v)} />
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                  {trend.map((_, i) => (
                    <Cell key={i} fill={i === trend.length - 1 ? '#0F6E56' : '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Category pie */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-dark mb-4">Distribución este mes</h2>
          {cats.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-slate-300 text-sm">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie
                  data={cats}
                  dataKey="total"
                  nameKey="category.name"
                  cx="50%" cy="50%"
                  outerRadius={85}
                  innerRadius={45}
                  labelLine={false}
                  label={CustomLabel as React.FC}
                >
                  {cats.map((c, i) => (
                    <Cell key={i} fill={c.category.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => fmtCOP(v)} />
                <Legend
                  formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Category table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-dark">Desglose por categoría</h2>
        </div>
        {cats.length === 0 ? (
          <p className="p-6 text-slate-400 text-sm text-center">Sin gastos este mes</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {cats.map((c, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.category.color }} />
                <span className="text-sm text-dark flex-1">{c.category.name}</span>
                <div className="flex items-center gap-3">
                  <div className="hidden sm:block w-28 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${c.pct}%`, backgroundColor: c.category.color }} />
                  </div>
                  <span className="text-xs text-slate-400 w-10 text-right">{c.pct}%</span>
                  <span className="text-sm font-semibold text-dark w-28 text-right">{fmtCOP(c.total)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Daily line chart */}
      {(dash?.dailyExpenses || []).length > 1 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-dark mb-4">Gastos diarios este mes</h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={dash!.dailyExpenses}>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={48} />
              <Tooltip formatter={(v: number) => fmtCOP(v)} />
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <Line type="monotone" dataKey="total" stroke="#0F6E56" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
