// src/pages/HabitsPage.tsx
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Flame, Check, Trash2, X, Settings } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../services/api'

interface Habit {
  id: string; name: string; emoji: string; color: string
  streak: number; bestStreak: number; completedToday: boolean
  reminderTime?: string; targetDays: number[]
}

const DAYS = ['L','M','X','J','V','S','D']

const habitApi = {
  list:   () => api.get('/habits'),
  create: (d: Record<string,unknown>) => api.post('/habits', d),
  toggle: (id: string) => api.post(`/habits/${id}/toggle`),
  update: (id: string, d: Record<string,unknown>) => api.put(`/habits/${id}`, d),
  remove: (id: string) => api.delete(`/habits/${id}`),
}

const COLORS = ['#0F6E56','#185FA5','#854F0B','#A32D2D','#534AB7','#3B6D11','#993556','#5F5E5A']
const EMOJIS = ['💪','📚','🏃','🧘','💧','🥗','😴','✍️','🎯','🎸','🌱','🧠','❤️','⭐']

export default function HabitsPage() {
  const qc = useQueryClient()
  const [showForm, setForm]   = useState(false)
  const [form, setForm2]      = useState({ name:'', emoji:'⭐', color:'#0F6E56', reminderTime:'', targetDays:[1,2,3,4,5,6,7] as number[] })
  const [saving, setSaving]   = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['habits'],
    queryFn: () => habitApi.list().then(r => r.data.data as Habit[])
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['habits'] })

  const toggle = async (id: string, name: string, done: boolean) => {
    try {
      const res = await habitApi.toggle(id)
      if (res.data.completed) toast.success(`✅ ${name} completado!${res.data.streak > 1 ? ` 🔥 Racha: ${res.data.streak}` : ''}`)
      refresh()
    } catch { toast.error('Error') }
  }

  const save = async () => {
    if (!form.name.trim()) { toast.error('Escribe el nombre del hábito'); return }
    setSaving(true)
    try {
      await habitApi.create(form)
      toast.success('Hábito creado')
      setForm(false); setForm2({ name:'', emoji:'⭐', color:'#0F6E56', reminderTime:'', targetDays:[1,2,3,4,5,6,7] })
      refresh()
    } catch { toast.error('Error al crear') }
    finally { setSaving(false) }
  }

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar hábito?')) return
    try { await habitApi.remove(id); toast.success('Eliminado'); refresh() }
    catch { toast.error('Error') }
  }

  const toggleDay = (day: number) => {
    setForm2(f => ({
      ...f,
      targetDays: f.targetDays.includes(day) ? f.targetDays.filter(d => d !== day) : [...f.targetDays, day]
    }))
  }

  const habits = data || []
  const completed = habits.filter(h => h.completedToday).length
  const total     = habits.length

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-dark">Hábitos</h1>
          {total > 0 && <p className="text-xs text-slate-400 mt-0.5">{completed}/{total} completados hoy</p>}
        </div>
        <button onClick={() => setForm(true)}
          className="flex items-center gap-1.5 bg-brand-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-brand-700">
          <Plus size={14} />Nuevo hábito
        </button>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-brand-500 rounded-full transition-all duration-500"
            style={{ width: `${(completed/total)*100}%` }} />
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-brand-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-dark">Nuevo hábito</h2>
            <button onClick={() => setForm(false)} className="p-1 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
          </div>

          {/* Emoji picker */}
          <div>
            <label className="text-xs text-slate-400 mb-2 block">Emoji</label>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setForm2(f => ({ ...f, emoji: e }))}
                  className={`text-xl w-9 h-9 rounded-lg flex items-center justify-center transition-all
                    ${form.emoji === e ? 'bg-brand-100 ring-2 ring-brand-500' : 'hover:bg-slate-100'}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          <input value={form.name} onChange={e => setForm2(f => ({ ...f, name: e.target.value }))}
            placeholder="Nombre del hábito (ej. Ir al gym)" autoFocus
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />

          {/* Color picker */}
          <div>
            <label className="text-xs text-slate-400 mb-2 block">Color</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button key={c} onClick={() => setForm2(f => ({ ...f, color: c }))}
                  className={`w-7 h-7 rounded-full transition-all ${form.color === c ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : ''}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {/* Days */}
          <div>
            <label className="text-xs text-slate-400 mb-2 block">Días</label>
            <div className="flex gap-1.5">
              {DAYS.map((d,i) => (
                <button key={i} onClick={() => toggleDay(i+1)}
                  className={`w-8 h-8 rounded-full text-xs font-medium transition-colors
                    ${form.targetDays.includes(i+1) ? 'text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  style={form.targetDays.includes(i+1) ? { backgroundColor: form.color } : {}}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Reminder */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Recordatorio por Telegram (opcional)</label>
            <input type="time" value={form.reminderTime} onChange={e => setForm2(f => ({ ...f, reminderTime: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>

          <div className="flex gap-2">
            <button onClick={() => setForm(false)} className="flex-1 border border-slate-200 rounded-lg py-2 text-sm text-slate-600">Cancelar</button>
            <button onClick={save} disabled={saving} className="flex-1 bg-brand-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
              {saving ? 'Guardando...' : 'Crear hábito'}
            </button>
          </div>
        </div>
      )}

      {/* Habit list */}
      {isLoading ? (
        <div className="py-10 text-center"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : habits.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-14 text-center">
          <p className="text-3xl mb-3">⭐</p>
          <p className="text-slate-400 text-sm">Sin hábitos todavía</p>
          <button onClick={() => setForm(true)} className="text-brand-600 text-sm font-medium mt-2 hover:underline">Crear el primero →</button>
        </div>
      ) : (
        <div className="space-y-2">
          {habits.map(h => (
            <div key={h.id} className={`bg-white rounded-xl border flex items-center gap-4 p-4 group transition-all
              ${h.completedToday ? 'border-green-200 bg-green-50/30' : 'border-slate-200'}`}>
              {/* Toggle button */}
              <button onClick={() => toggle(h.id, h.name, h.completedToday)}
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-all shrink-0 ${h.completedToday ? 'opacity-60' : 'hover:scale-105'}`}
                style={{ backgroundColor: h.completedToday ? '#dcfce7' : `${h.color}15`, border: `2px solid ${h.completedToday ? '#86efac' : h.color}` }}>
                {h.completedToday ? <Check size={20} className="text-green-600" /> : <span>{h.emoji}</span>}
              </button>

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${h.completedToday ? 'text-slate-400 line-through' : 'text-dark'}`}>{h.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  {h.streak > 0 && (
                    <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                      <Flame size={12} className="text-amber-500" />{h.streak} días
                    </span>
                  )}
                  {h.bestStreak > 0 && h.streak !== h.bestStreak && (
                    <span className="text-xs text-slate-400">Récord: {h.bestStreak}</span>
                  )}
                  <div className="flex gap-0.5 ml-auto">
                    {DAYS.map((d,i) => (
                      <span key={i} className={`w-5 h-5 rounded text-xs flex items-center justify-center ${h.targetDays?.includes(i+1) ? 'text-white font-medium' : 'bg-slate-100 text-slate-300'}`}
                        style={h.targetDays?.includes(i+1) ? { backgroundColor: h.color } : {}}>
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <button onClick={() => remove(h.id)}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
