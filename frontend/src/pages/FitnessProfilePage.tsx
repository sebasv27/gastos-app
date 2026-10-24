// src/pages/FitnessProfilePage.tsx
import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Flame, Beef, Wheat, Droplet, Save, RefreshCw, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import { fitnessProfileApi, bodyLogApi } from '../services/api'
import { FitnessProfile, Sex, ActivityLevel, FitnessGoal } from '../types'

const ACTIVITY_LABELS: Record<ActivityLevel, { label: string; desc: string }> = {
  SEDENTARY:   { label: 'Sedentario',     desc: 'Trabajo de oficina, poco o nada de ejercicio' },
  LIGHT:       { label: 'Ligero',         desc: 'Ejercicio ligero 1-3 días por semana' },
  MODERATE:    { label: 'Moderado',       desc: 'Ejercicio moderado 3-5 días por semana' },
  ACTIVE:      { label: 'Activo',         desc: 'Ejercicio intenso 6-7 días por semana' },
  VERY_ACTIVE: { label: 'Muy activo',     desc: 'Atleta — entreno + trabajo físico' },
}

const GOAL_LABELS: Record<FitnessGoal, { label: string; desc: string; color: string }> = {
  CUT:    { label: 'Definición',  desc: 'Déficit calórico — perder grasa preservando músculo', color: '#A32D2D' },
  RECOMP: { label: 'Recomposición', desc: 'Mantenimiento — ganar músculo y perder grasa a la vez', color: '#185FA5' },
  BULK:   { label: 'Volumen',     desc: 'Superávit calórico — ganar músculo', color: '#0F6E56' },
}

export default function FitnessProfilePage() {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    sex: 'MALE' as Sex,
    birthDate: '',
    heightCm: '',
    activityLevel: 'MODERATE' as ActivityLevel,
    goal: 'RECOMP' as FitnessGoal,
  })
  const [saving, setSaving] = useState(false)

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['fitness-profile'],
    queryFn: () => fitnessProfileApi.get().then(r => r.data.data as FitnessProfile | null)
  })

  const { data: weightData } = useQuery({
    queryKey: ['body-logs', 30],
    queryFn: () => bodyLogApi.list(30).then(r => r.data.data)
  })
  const hasWeight = (weightData || []).length > 0

  useEffect(() => {
    if (profileData) {
      setForm({
        sex: profileData.sex,
        birthDate: profileData.birthDate ? profileData.birthDate.split('T')[0] : '',
        heightCm: profileData.heightCm ? String(profileData.heightCm) : '',
        activityLevel: profileData.activityLevel,
        goal: profileData.goal,
      })
    }
  }, [profileData])

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.birthDate || !form.heightCm) {
      toast.error('Fecha de nacimiento y altura son requeridos')
      return
    }
    setSaving(true)
    try {
      await fitnessProfileApi.upsert(form)
      toast.success('Perfil guardado — macros recalculadas')
      qc.invalidateQueries({ queryKey: ['fitness-profile'] })
    } catch {
      toast.error('Error al guardar perfil')
    } finally {
      setSaving(false)
    }
  }

  const recalc = async () => {
    try {
      await fitnessProfileApi.recalculate()
      toast.success('Macros recalculadas con tu peso más reciente')
      qc.invalidateQueries({ queryKey: ['fitness-profile'] })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || 'Error al recalcular')
    }
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const hasMacros = profileData?.targetCalories

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-dark">Perfil y Macros</h1>
        <p className="text-slate-500 text-sm mt-0.5">Calculado con la fórmula Mifflin-St Jeor</p>
      </div>

      {/* Resultado de macros */}
      {hasMacros ? (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-dark">Tus objetivos diarios</h2>
            <button onClick={recalc}
              className="flex items-center gap-1.5 text-xs text-brand-600 hover:underline">
              <RefreshCw size={11} />Recalcular
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <Flame size={18} className="text-amber-500 mx-auto mb-1.5" />
              <p className="text-xl font-bold text-dark">{profileData!.targetCalories}</p>
              <p className="text-xs text-slate-400 mt-0.5">kcal/día</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <Beef size={18} className="text-red-500 mx-auto mb-1.5" />
              <p className="text-xl font-bold text-dark">{profileData!.targetProteinG}g</p>
              <p className="text-xs text-slate-400 mt-0.5">Proteína</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <Wheat size={18} className="text-amber-600 mx-auto mb-1.5" />
              <p className="text-xl font-bold text-dark">{profileData!.targetCarbsG}g</p>
              <p className="text-xs text-slate-400 mt-0.5">Carbohidratos</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <Droplet size={18} className="text-blue-500 mx-auto mb-1.5" />
              <p className="text-xl font-bold text-dark">{profileData!.targetFatG}g</p>
              <p className="text-xs text-slate-400 mt-0.5">Grasa</p>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4 text-xs text-slate-400">
            <Info size={12} />
            <span>TDEE (gasto calórico total): {profileData!.tdee} kcal — ajustado por tu objetivo de {GOAL_LABELS[profileData!.goal].label.toLowerCase()}</span>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700">
            {!hasWeight
              ? 'Registra tu peso en la sección Progreso para que podamos calcular tus macros.'
              : 'Completa tu perfil abajo para calcular tus calorías y macros objetivo.'}
          </p>
        </div>
      )}

      {/* Formulario */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
        <h2 className="text-sm font-semibold text-dark">Datos personales</h2>

        {/* Sexo */}
        <div>
          <label className="text-xs text-slate-500 mb-2 block">Sexo biológico</label>
          <div className="flex gap-2">
            {(['MALE', 'FEMALE'] as Sex[]).map(s => (
              <button key={s} onClick={() => set('sex', s)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${form.sex === s ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {s === 'MALE' ? 'Hombre' : 'Mujer'}
              </button>
            ))}
          </div>
        </div>

        {/* Fecha de nacimiento + altura */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Fecha de nacimiento</label>
            <input type="date" value={form.birthDate} onChange={e => set('birthDate', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Altura (cm)</label>
            <input type="number" value={form.heightCm} onChange={e => set('heightCm', e.target.value)}
              placeholder="175"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
        </div>

        {/* Nivel de actividad */}
        <div>
          <label className="text-xs text-slate-500 mb-2 block">Nivel de actividad</label>
          <div className="space-y-1.5">
            {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map(level => (
              <button key={level} onClick={() => set('activityLevel', level)}
                className={`w-full text-left p-3 rounded-lg border transition-colors
                  ${form.activityLevel === level
                    ? 'border-brand-400 bg-brand-50'
                    : 'border-slate-200 hover:bg-slate-50'}`}>
                <p className={`text-sm font-medium ${form.activityLevel === level ? 'text-brand-700' : 'text-dark'}`}>
                  {ACTIVITY_LABELS[level].label}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{ACTIVITY_LABELS[level].desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Objetivo */}
        <div>
          <label className="text-xs text-slate-500 mb-2 block">Objetivo</label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(GOAL_LABELS) as FitnessGoal[]).map(g => (
              <button key={g} onClick={() => set('goal', g)}
                className={`p-3 rounded-lg border text-center transition-colors
                  ${form.goal === g ? 'border-current' : 'border-slate-200 hover:bg-slate-50'}`}
                style={form.goal === g ? { color: GOAL_LABELS[g].color, backgroundColor: `${GOAL_LABELS[g].color}10` } : {}}>
                <p className="text-sm font-semibold">{GOAL_LABELS[g].label}</p>
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2">{GOAL_LABELS[form.goal].desc}</p>
        </div>

        <button onClick={save} disabled={saving}
          className="w-full bg-brand-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
          <Save size={14} />{saving ? 'Guardando...' : 'Guardar y calcular macros'}
        </button>
      </div>
    </div>
  )
}
