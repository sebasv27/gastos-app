// src/pages/MealsPage.tsx
import { useState, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Camera, Plus, Trash2, Flame, Beef, Wheat, Droplet,
  Upload, Loader2, CheckCircle, X, Keyboard
} from 'lucide-react'
import toast from 'react-hot-toast'
import { mealApi } from '../services/api'
import { TodayMealsSummary, MealType, Meal } from '../types'

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  BREAKFAST: 'Desayuno', LUNCH: 'Almuerzo', DINNER: 'Cena', SNACK: 'Snack', OTHER: 'Otro'
}

function MacroBar({ label, value, target, color, unit = 'g' }: {
  label: string; value: number; target?: number; color: string; unit?: string
}) {
  const pct = target ? Math.min(Math.round((value / target) * 100), 100) : 0
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-500">{label}</span>
        <span className="font-medium text-dark">
          {Math.round(value)}{unit}{target ? ` / ${Math.round(target)}${unit}` : ''}
        </span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

export default function MealsPage() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [mode, setMode] = useState<'camera' | 'manual'>('camera')

  const { data, isLoading } = useQuery({
    queryKey: ['meals-today'],
    queryFn: () => mealApi.getTodaySummary().then(r => r.data.data as TodayMealsSummary)
  })

  const removeMeal = async (id: string) => {
    try {
      await mealApi.remove(id)
      toast.success('Eliminado')
      qc.invalidateQueries({ queryKey: ['meals-today'] })
    } catch { toast.error('Error al eliminar') }
  }

  const totals  = data?.totals
  const targets = data?.targets

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-dark">Comidas</h1>
          <p className="text-slate-500 text-sm mt-0.5">Hoy</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-brand-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-brand-700">
          <Plus size={14} />Registrar comida
        </button>
      </div>

      {/* Daily totals */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flame size={16} className="text-amber-500" />
            <span className="text-2xl font-bold text-dark">{Math.round(totals?.calories || 0)}</span>
            <span className="text-sm text-slate-400">
              {targets?.calories ? `/ ${targets.calories} kcal` : 'kcal'}
            </span>
          </div>
          {targets?.calories && (
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
              (totals?.calories || 0) > targets.calories
                ? 'bg-red-50 text-red-600'
                : 'bg-brand-50 text-brand-600'
            }`}>
              {Math.round(((totals?.calories || 0) / targets.calories) * 100)}%
            </span>
          )}
        </div>

        <div className="space-y-3">
          <MacroBar label="Proteína" value={totals?.proteinG || 0} target={targets?.proteinG} color="#A32D2D" />
          <MacroBar label="Carbohidratos" value={totals?.carbsG || 0} target={targets?.carbsG} color="#854F0B" />
          <MacroBar label="Grasa" value={totals?.fatG || 0} target={targets?.fatG} color="#185FA5" />
        </div>

        {!targets && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mt-3">
            Configura tu perfil de fitness para ver objetivos diarios de macros
          </p>
        )}
      </div>

      {/* Meals list */}
      {isLoading ? (
        <div className="py-10 text-center">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : !data || data.meals.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-12 text-center">
          <Camera size={28} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Sin comidas registradas hoy</p>
          <button onClick={() => setShowModal(true)} className="text-brand-600 text-sm font-medium mt-2 hover:underline">
            Registrar la primera →
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {data.meals.map((meal: Meal) => (
            <div key={meal.id} className="flex items-center gap-3 px-4 py-3 group">
              <div className="w-9 h-9 rounded-full bg-brand-50 flex items-center justify-center shrink-0">
                {meal.source === 'PHOTO_OCR' ? <Camera size={14} className="text-brand-600" /> : <Flame size={14} className="text-brand-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-dark truncate">{meal.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-400">{MEAL_TYPE_LABELS[meal.mealType]}</span>
                  <span className="text-slate-200">·</span>
                  <span className="text-xs text-slate-400">P {Math.round(meal.proteinG)}g · C {Math.round(meal.carbsG)}g · G {Math.round(meal.fatG)}g</span>
                </div>
              </div>
              <span className="text-sm font-semibold text-dark shrink-0">{Math.round(meal.calories)} kcal</span>
              <button onClick={() => removeMeal(meal.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-500 shrink-0">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <AddMealModal
          initialMode={mode}
          onModeChange={setMode}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); qc.invalidateQueries({ queryKey: ['meals-today'] }) }}
        />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// MODAL — captura de comida (foto OCR o manual)
// ════════════════════════════════════════════════════════════════════════

interface ModalProps {
  initialMode: 'camera' | 'manual'
  onModeChange: (m: 'camera' | 'manual') => void
  onClose: () => void
  onSuccess: () => void
}

function AddMealModal({ initialMode, onModeChange, onClose, onSuccess }: ModalProps) {
  const [mode, setMode] = useState(initialMode)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null)
  const [ocrError, setOcrError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '', mealType: 'OTHER' as MealType,
    calories: '', proteinG: '', carbsG: '', fatG: ''
  })
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const switchMode = (m: 'camera' | 'manual') => { setMode(m); onModeChange(m) }
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleFile = useCallback(async (file: File) => {
    setOcrError(null)
    setPreviewUrl(URL.createObjectURL(file))
    setOcrLoading(true)
    try {
      const res = await mealApi.scanPhoto(file)
      const d = res.data.data
      setForm({
        name: d.name || '',
        mealType: d.mealType || 'OTHER',
        calories: String(d.calories || ''),
        proteinG: String(d.proteinG || ''),
        carbsG:   String(d.carbsG || ''),
        fatG:     String(d.fatG || ''),
      })
      setOcrConfidence(d.confidence)
      toast.success('Foto analizada')
      switchMode('manual')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setOcrError(msg || 'No se pudo analizar la foto')
    } finally {
      setOcrLoading(false)
    }
  }, [])

  const submit = async () => {
    if (!form.name || !form.calories) { toast.error('Nombre y calorías requeridos'); return }
    setSaving(true)
    try {
      await mealApi.create({
        ...form,
        calories: parseFloat(form.calories),
        proteinG: parseFloat(form.proteinG) || 0,
        carbsG:   parseFloat(form.carbsG) || 0,
        fatG:     parseFloat(form.fatG) || 0,
        source: previewUrl ? 'PHOTO_OCR' : 'MANUAL'
      })
      toast.success('Comida registrada')
      onSuccess()
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4 bg-black/50">
      <div className="bg-slate-50 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[95dvh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="font-semibold text-dark text-base">Registrar comida</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pb-3">
          <div className="flex gap-1.5 bg-slate-200/70 p-1 rounded-2xl">
            <button onClick={() => switchMode('camera')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium ${
                mode === 'camera' ? 'bg-white shadow text-brand-700' : 'text-slate-500'}`}>
              <Camera size={14} />Foto
            </button>
            <button onClick={() => switchMode('manual')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium ${
                mode === 'manual' ? 'bg-white shadow text-brand-700' : 'text-slate-500'}`}>
              <Keyboard size={14} />Manual
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 pb-2 space-y-3">
          {mode === 'camera' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 text-center">
                Toma una foto de tu plato — Gemini estima las calorías y macros automáticamente
              </p>

              {!ocrLoading && !previewUrl && (
                <div onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-brand-400 rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer bg-white">
                  <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center">
                    <Upload size={24} className="text-brand-500" />
                  </div>
                  <p className="text-sm font-medium text-dark">Sube o toma una foto</p>
                  <button className="bg-brand-600 text-white px-5 py-2 rounded-xl text-sm font-medium flex items-center gap-2">
                    <Camera size={15} />Tomar foto
                  </button>
                </div>
              )}

              {ocrLoading && (
                <div className="rounded-2xl bg-white border border-slate-200 p-8 flex flex-col items-center gap-4">
                  {previewUrl && <img src={previewUrl} className="max-h-40 rounded-xl object-contain" alt="preview" />}
                  <Loader2 size={28} className="text-brand-500 animate-spin" />
                  <p className="text-sm font-medium text-dark">Analizando comida...</p>
                </div>
              )}

              {ocrError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
                  {ocrError}
                </div>
              )}

              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            </div>
          )}

          {mode === 'manual' && (
            <div className="space-y-3">
              {ocrConfidence !== null && (
                <div className="flex items-center gap-2 bg-brand-50 border border-brand-200 rounded-xl p-3 text-xs text-brand-700">
                  <CheckCircle size={14} />
                  Datos estimados — confianza {Math.round(ocrConfidence * 100)}%. Ajusta si es necesario.
                </div>
              )}

              <div className="bg-white rounded-xl border border-slate-200 p-3">
                <label className="text-xs text-slate-400 mb-1 block">Nombre del plato</label>
                <input value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="ej. Pollo con arroz y aguacate"
                  className="w-full text-sm bg-transparent focus:outline-none" />
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-3">
                <label className="text-xs text-slate-400 mb-1 block">Tipo de comida</label>
                <select value={form.mealType} onChange={e => set('mealType', e.target.value)}
                  className="w-full text-sm bg-transparent focus:outline-none">
                  {Object.entries(MEAL_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-3">
                <label className="text-xs text-slate-400 mb-1 block">Calorías totales</label>
                <input type="number" value={form.calories} onChange={e => set('calories', e.target.value)}
                  placeholder="0"
                  className="w-full text-2xl font-bold text-dark bg-transparent focus:outline-none" />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white rounded-xl border border-slate-200 p-3">
                  <label className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Beef size={10} />Prot.</label>
                  <input type="number" value={form.proteinG} onChange={e => set('proteinG', e.target.value)}
                    placeholder="0g" className="w-full text-sm bg-transparent focus:outline-none" />
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-3">
                  <label className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Wheat size={10} />Carbs</label>
                  <input type="number" value={form.carbsG} onChange={e => set('carbsG', e.target.value)}
                    placeholder="0g" className="w-full text-sm bg-transparent focus:outline-none" />
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-3">
                  <label className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Droplet size={10} />Grasa</label>
                  <input type="number" value={form.fatG} onChange={e => set('fatG', e.target.value)}
                    placeholder="0g" className="w-full text-sm bg-transparent focus:outline-none" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex gap-2.5 bg-white rounded-b-2xl">
          <button onClick={onClose}
            className="flex-1 border border-slate-200 rounded-xl py-2.5 text-sm text-slate-600 hover:bg-slate-50 font-medium">
            Cancelar
          </button>
          <button onClick={submit} disabled={saving || mode === 'camera'}
            className="flex-1 bg-brand-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-brand-700 disabled:opacity-40 transition-colors">
            {saving ? 'Guardando...' : 'Guardar comida'}
          </button>
        </div>
      </div>
    </div>
  )
}
