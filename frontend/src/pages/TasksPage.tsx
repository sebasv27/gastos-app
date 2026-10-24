// src/pages/TasksPage.tsx
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Check, Trash2, Clock, Flag, X,
  AlertTriangle, ChevronDown, ChevronUp, Circle
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../services/api'

type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
type Status   = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

interface Task {
  id: string; title: string; description?: string
  priority: Priority; status: Status
  dueDate?: string; dueTime?: string; completedAt?: string
  tags: string[]
}

const PRIORITY_META: Record<Priority, { label: string; color: string; bg: string; icon: string }> = {
  LOW:    { label: 'Baja',    color: 'text-slate-500', bg: 'bg-slate-100',  icon: '○' },
  MEDIUM: { label: 'Media',   color: 'text-blue-600',  bg: 'bg-blue-50',    icon: '◎' },
  HIGH:   { label: 'Alta',    color: 'text-amber-600', bg: 'bg-amber-50',   icon: '●' },
  URGENT: { label: 'Urgente', color: 'text-red-600',   bg: 'bg-red-50',     icon: '⚡' },
}

const taskApi = {
  list:     (p?: Record<string,string>) => api.get('/tasks', { params: p }),
  today:    () => api.get('/tasks/today'),
  create:   (d: Record<string,unknown>) => api.post('/tasks', d),
  update:   (id: string, d: Record<string,unknown>) => api.put(`/tasks/${id}`, d),
  complete: (id: string) => api.post(`/tasks/${id}/complete`),
  remove:   (id: string) => api.delete(`/tasks/${id}`),
}

export default function TasksPage() {
  const qc = useQueryClient()
  const [filter, setFilter]   = useState<'all' | 'pending' | 'completed'>('pending')
  const [showForm, setForm]   = useState(false)
  const [editTask, setEdit]   = useState<Task | null>(null)
  const [form, setForm2]      = useState({ title:'', description:'', priority:'MEDIUM' as Priority, dueDate:'', dueTime:'' })
  const [saving, setSaving]   = useState(false)

  const { data: todayData } = useQuery({ queryKey:['tasks-today'], queryFn: () => taskApi.today().then(r => r.data.data) })
  const { data, isLoading } = useQuery({
    queryKey: ['tasks', filter],
    queryFn: () => taskApi.list(filter !== 'all' ? { status: filter === 'pending' ? 'PENDING' : 'COMPLETED' } : {}).then(r => r.data.data as Task[])
  })

  const refresh = () => { qc.invalidateQueries({ queryKey: ['tasks'] }); qc.invalidateQueries({ queryKey: ['tasks-today'] }) }

  const save = async () => {
    if (!form.title.trim()) { toast.error('Escribe el título'); return }
    setSaving(true)
    try {
      if (editTask) {
        await taskApi.update(editTask.id, form)
        toast.success('Tarea actualizada')
      } else {
        await taskApi.create(form)
        toast.success('Tarea creada')
      }
      setForm(false); setEdit(null)
      setForm2({ title:'', description:'', priority:'MEDIUM', dueDate:'', dueTime:'' })
      refresh()
    } catch { toast.error('Error al guardar') }
    finally { setSaving(false) }
  }

  const complete = async (id: string) => {
    try { await taskApi.complete(id); refresh() }
    catch { toast.error('Error') }
  }

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar tarea?')) return
    try { await taskApi.remove(id); toast.success('Eliminada'); refresh() }
    catch { toast.error('Error') }
  }

  const openEdit = (t: Task) => {
    setEdit(t)
    setForm2({ title: t.title, description: t.description||'', priority: t.priority, dueDate: t.dueDate ? t.dueDate.split('T')[0] : '', dueTime: t.dueTime||'' })
    setForm(true)
  }

  const tasks = data || []

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-dark">Tareas</h1>
          {todayData && (
            <p className="text-xs text-slate-400 mt-0.5">
              {todayData.completed} completadas · {todayData.pending} pendientes
              {todayData.overdue > 0 && <span className="text-red-500 ml-1">· {todayData.overdue} vencidas</span>}
            </p>
          )}
        </div>
        <button onClick={() => { setEdit(null); setForm2({ title:'', description:'', priority:'MEDIUM', dueDate:'', dueTime:'' }); setForm(true) }}
          className="flex items-center gap-1.5 bg-brand-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-brand-700">
          <Plus size={14} />Nueva tarea
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-brand-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-dark">{editTask ? 'Editar tarea' : 'Nueva tarea'}</h2>
            <button onClick={() => setForm(false)} className="p-1 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
          </div>
          <input value={form.title} onChange={e => setForm2(f => ({ ...f, title: e.target.value }))}
            placeholder="¿Qué hay que hacer?" autoFocus
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500" />
          <input value={form.description} onChange={e => setForm2(f => ({ ...f, description: e.target.value }))}
            placeholder="Descripción (opcional)"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Prioridad</label>
              <select value={form.priority} onChange={e => setForm2(f => ({ ...f, priority: e.target.value as Priority }))}
                className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                {Object.entries(PRIORITY_META).map(([k,v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Fecha límite</label>
              <input type="date" value={form.dueDate} onChange={e => setForm2(f => ({ ...f, dueDate: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Hora</label>
              <input type="time" value={form.dueTime} onChange={e => setForm2(f => ({ ...f, dueTime: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setForm(false)} className="flex-1 border border-slate-200 rounded-lg py-2 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button onClick={save} disabled={saving} className="flex-1 bg-brand-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
              {saving ? 'Guardando...' : editTask ? 'Guardar cambios' : 'Crear tarea'}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-1.5">
        {[['pending','Pendientes'],['all','Todas'],['completed','Completadas']].map(([k,l]) => (
          <button key={k} onClick={() => setFilter(k as typeof filter)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors
              ${filter === k ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Task list */}
      {isLoading ? (
        <div className="py-10 text-center"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : tasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-14 text-center">
          <Circle size={28} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">{filter === 'completed' ? 'Sin tareas completadas' : 'Sin tareas pendientes'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map(t => {
            const p = PRIORITY_META[t.priority]
            const done = t.status === 'COMPLETED'
            const overdue = !done && t.dueDate && new Date(t.dueDate) < new Date()
            return (
              <div key={t.id} className={`bg-white rounded-xl border p-4 flex items-start gap-3 group transition-all
                ${done ? 'border-slate-100 opacity-60' : overdue ? 'border-red-200' : 'border-slate-200'}`}>
                <button onClick={() => complete(t.id)}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors
                    ${done ? 'bg-brand-500 border-brand-500' : 'border-slate-300 hover:border-brand-400'}`}>
                  {done && <Check size={12} className="text-white" />}
                </button>
                <div className="flex-1 min-w-0" onClick={() => !done && openEdit(t)}>
                  <p className={`text-sm font-medium cursor-pointer ${done ? 'line-through text-slate-400' : 'text-dark'}`}>{t.title}</p>
                  {t.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{t.description}</p>}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${p.color} ${p.bg}`}>{p.icon} {p.label}</span>
                    {t.dueDate && (
                      <span className={`flex items-center gap-1 text-xs ${overdue ? 'text-red-500' : 'text-slate-400'}`}>
                        {overdue && <AlertTriangle size={11} />}
                        <Clock size={10} />{new Date(t.dueDate).toLocaleDateString('es-CO', { day:'2-digit', month:'short' })}
                        {t.dueTime && ` ${t.dueTime}`}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => remove(t.id)}
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
