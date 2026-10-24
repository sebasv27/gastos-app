// src/pages/RoutinePage.tsx
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, X, Clock, Bell } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../services/api'

interface Block {
  id: string; title: string; emoji: string
  startTime: string; endTime: string
  days: number[]; color: string; reminderMin: number
}

const DAYS = ['L','M','X','J','V','S','D']
const COLORS = ['#0F6E56','#185FA5','#854F0B','#A32D2D','#534AB7','#3B6D11','#993556']
const EMOJIS = ['📌','🏋️','📚','☕','🍽️','😴','💻','🧘','🎯','🚶','💊','🎸']

const routineApi = {
  list:   () => api.get('/routine'),
  today:  () => api.get('/routine/today'),
  create: (d: Record<string,unknown>) => api.post('/routine', d),
  remove: (id: string) => api.delete(`/routine/${id}`),
}

const minutesFromTime = (t: string) => {
  const [h,m] = t.split(':').map(Number); return h*60+m
}

const blockHeight = (start: string, end: string) => {
  const mins = minutesFromTime(end) - minutesFromTime(start)
  return Math.max(48, mins * 1.2)
}

export default function RoutinePage() {
  const qc = useQueryClient()
  const [view, setView]     = useState<'today' | 'all'>('today')
  const [showForm, setForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm2]    = useState({ title:'', emoji:'📌', startTime:'07:00', endTime:'08:00', days:[1,2,3,4,5] as number[], color:'#0F6E56', reminderMin:5 })

  const { data: todayBlocks } = useQuery({ queryKey:['routine-today'], queryFn: () => routineApi.today().then(r => r.data.data as Block[]) })
  const { data: allBlocks, isLoading } = useQuery({ queryKey:['routine-all'], queryFn: () => routineApi.list().then(r => r.data.data as Block[]) })

  const refresh = () => { qc.invalidateQueries({ queryKey: ['routine-today'] }); qc.invalidateQueries({ queryKey: ['routine-all'] }) }

  const save = async () => {
    if (!form.title.trim()) { toast.error('Escribe el título'); return }
    if (form.startTime >= form.endTime) { toast.error('La hora de inicio debe ser antes del fin'); return }
    setSaving(true)
    try {
      await routineApi.create(form)
      toast.success('Bloque agregado')
      setForm(false); setForm2({ title:'', emoji:'📌', startTime:'07:00', endTime:'08:00', days:[1,2,3,4,5], color:'#0F6E56', reminderMin:5 })
      refresh()
    } catch { toast.error('Error al guardar') }
    finally { setSaving(false) }
  }

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar bloque?')) return
    try { await routineApi.remove(id); toast.success('Eliminado'); refresh() }
    catch { toast.error('Error') }
  }

  const toggleDay = (d: number) =>
    setForm2(f => ({ ...f, days: f.days.includes(d) ? f.days.filter(x => x !== d) : [...f.days, d] }))

  const blocks = view === 'today' ? (todayBlocks||[]) : (allBlocks||[])

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-dark">Rutina diaria</h1>
          <p className="text-xs text-slate-400 mt-0.5">{todayBlocks?.length || 0} bloques para hoy</p>
        </div>
        <button onClick={() => setForm(true)}
          className="flex items-center gap-1.5 bg-brand-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-brand-700">
          <Plus size={14} />Agregar bloque
        </button>
      </div>

      {/* View toggle */}
      <div className="flex gap-1.5">
        {[['today','Hoy'],['all','Todos']].map(([k,l]) => (
          <button key={k} onClick={() => setView(k as typeof view)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors
              ${view === k ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-500'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-brand-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-dark">Nuevo bloque</h2>
            <button onClick={() => setForm(false)}><X size={16} /></button>
          </div>

          <div className="flex gap-2 items-center">
            <div className="flex gap-1.5 flex-wrap">
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setForm2(f => ({ ...f, emoji: e }))}
                  className={`text-xl w-9 h-9 rounded-lg ${form.emoji === e ? 'bg-brand-100 ring-2 ring-brand-500' : 'hover:bg-slate-100'}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          <input value={form.title} onChange={e => setForm2(f => ({ ...f, title: e.target.value }))}
            placeholder="¿Qué vas a hacer? (ej. Gym, Estudio)" autoFocus
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Hora inicio</label>
              <input type="time" value={form.startTime} onChange={e => setForm2(f => ({ ...f, startTime: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Hora fin</label>
              <input type="time" value={form.endTime} onChange={e => setForm2(f => ({ ...f, endTime: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>

          {/* Days */}
          <div>
            <label className="text-xs text-slate-400 mb-2 block">Días de la semana</label>
            <div className="flex gap-1.5">
              {DAYS.map((d,i) => (
                <button key={i} onClick={() => toggleDay(i+1)}
                  className={`w-8 h-8 rounded-full text-xs font-medium transition-colors
                    ${form.days.includes(i+1) ? 'text-white' : 'bg-slate-100 text-slate-500'}`}
                  style={form.days.includes(i+1) ? { backgroundColor: form.color } : {}}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="text-xs text-slate-400 mb-2 block">Color</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button key={c} onClick={() => setForm2(f => ({ ...f, color: c }))}
                  className={`w-7 h-7 rounded-full ${form.color === c ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : ''}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {/* Reminder */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Recordatorio por Telegram</label>
            <select value={form.reminderMin} onChange={e => setForm2(f => ({ ...f, reminderMin: parseInt(e.target.value) }))}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value={0}>Sin recordatorio</option>
              <option value={5}>5 min antes</option>
              <option value={10}>10 min antes</option>
              <option value={15}>15 min antes</option>
              <option value={30}>30 min antes</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setForm(false)} className="flex-1 border border-slate-200 rounded-lg py-2 text-sm text-slate-600">Cancelar</button>
            <button onClick={save} disabled={saving} className="flex-1 bg-brand-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
              {saving ? 'Guardando...' : 'Agregar bloque'}
            </button>
          </div>
        </div>
      )}

      {/* Blocks */}
      {isLoading ? (
        <div className="py-10 text-center"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : blocks.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-14 text-center">
          <Clock size={28} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">{view === 'today' ? 'Sin bloques para hoy' : 'Sin bloques de rutina'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...blocks].sort((a,b) => a.startTime.localeCompare(b.startTime)).map(b => {
            const mins = minutesFromTime(b.endTime) - minutesFromTime(b.startTime)
            return (
              <div key={b.id} className="bg-white rounded-xl border border-slate-200 flex items-center gap-3 p-3 group">
                <div className="w-1.5 h-12 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: `${b.color}20` }}>
                  {b.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-dark">{b.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock size={10} />{b.startTime} - {b.endTime} ({mins} min)
                    </span>
                    {b.reminderMin > 0 && <span className="flex items-center gap-1 text-xs text-slate-400"><Bell size={10} />{b.reminderMin} min antes</span>}
                  </div>
                  {view === 'all' && (
                    <div className="flex gap-0.5 mt-1">
                      {DAYS.map((d,i) => (
                        <span key={i} className={`w-5 h-5 rounded text-xs flex items-center justify-center font-medium
                          ${b.days?.includes(i+1) ? 'text-white' : 'bg-slate-100 text-slate-300'}`}
                          style={b.days?.includes(i+1) ? { backgroundColor: b.color } : {}}>
                          {d}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => remove(b.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
