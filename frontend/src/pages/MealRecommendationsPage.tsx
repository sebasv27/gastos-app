// src/pages/MealRecommendationsPage.tsx
import { useState, useCallback } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Sparkles, ChefHat, Timer, Flame, Beef, Wheat, Droplet,
  ChevronDown, ChevronUp, Loader2, BookOpen, Utensils,
  Star, Plus, Check, RefreshCw, ShoppingCart
} from 'lucide-react'
import toast from 'react-hot-toast'
import { mealRecommendationApi, mealApi } from '../services/api'
import { Recipe, MealRecommendationResult } from '../types'

// Fallback si no hay imágenes disponibles
const FOOD_PLACEHOLDERS: Record<string, string> = {
  BREAKFAST: '🥞', LUNCH: '🍱', DINNER: '🍽️', SNACK: '🥗', OTHER: '🍴'
}

const DIFFICULTY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Muy fácil', color: 'text-brand-600 bg-brand-50' },
  2: { label: 'Fácil',     color: 'text-amber-600 bg-amber-50' },
  3: { label: 'Moderado',  color: 'text-red-600 bg-red-50' },
}

const MEAL_TYPE_ES: Record<string, string> = {
  BREAKFAST: 'Desayuno', LUNCH: 'Almuerzo', DINNER: 'Cena', SNACK: 'Snack', OTHER: 'Comida'
}

function MacroChip({ icon, value, unit = 'g', color }: { icon: React.ReactNode; value: number; unit?: string; color: string }) {
  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${color}`}>
      {icon}<span>{Math.round(value)}{unit}</span>
    </div>
  )
}

function DifficultyStars({ level }: { level: 1 | 2 | 3 }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3].map(i => (
        <Star key={i} size={11} className={i <= level ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'} />
      ))}
    </div>
  )
}

// ── Componente de imagen con búsqueda lazy ───────────────────────────────────
function RecipeImage({ query, emoji, name }: { query: string; emoji: string; name: string }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [tried, setTried]   = useState(false)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (tried) return
    setTried(true)
    setLoading(true)
    try {
      const res = await fetch(`/api/meal-recommendations/image-search?q=${encodeURIComponent(query)}`)
      if (res.ok) {
        const data = await res.json()
        if (data.url) setImgUrl(data.url)
      }
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }, [query, tried])

  if (!tried) {
    load()
    return (
      <div className="w-full h-48 bg-gradient-to-br from-brand-50 to-slate-100 rounded-xl flex items-center justify-center">
        <span className="text-6xl">{emoji}</span>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="w-full h-48 bg-slate-100 rounded-xl flex items-center justify-center animate-pulse">
        <Loader2 size={24} className="text-slate-300 animate-spin" />
      </div>
    )
  }

  if (imgUrl) {
    return (
      <img src={imgUrl} alt={name}
        className="w-full h-48 object-cover rounded-xl"
        onError={() => setImgUrl(null)} />
    )
  }

  return (
    <div className="w-full h-48 bg-gradient-to-br from-brand-50 to-slate-100 rounded-xl flex items-center justify-center">
      <span className="text-6xl">{emoji}</span>
    </div>
  )
}

// ── Card de receta ────────────────────────────────────────────────────────────
function RecipeCard({ recipe, onSave }: { recipe: Recipe; onSave: (r: Recipe) => Promise<void> }) {
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)

  const diff = DIFFICULTY_LABELS[recipe.difficulty]
  const totalMin = recipe.prepMinutes + recipe.cookMinutes

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(recipe)
      setSaved(true)
      toast.success(`"${recipe.name}" guardado en tus comidas`)
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Imagen */}
      <div className="relative">
        <RecipeImage query={recipe.searchQuery} emoji={recipe.emoji} name={recipe.name} />
        <div className="absolute top-3 left-3 flex gap-1.5">
          <span className="bg-white/90 backdrop-blur text-xs font-medium px-2 py-1 rounded-full text-slate-700">
            {MEAL_TYPE_ES[recipe.mealType]}
          </span>
          <span className="bg-white/90 backdrop-blur text-xs font-medium px-2 py-1 rounded-full text-slate-500 capitalize">
            {recipe.style}
          </span>
        </div>
        <button onClick={handleSave} disabled={saving || saved}
          className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-all
            ${saved ? 'bg-brand-600 text-white' : 'bg-white hover:bg-brand-50 text-slate-600'}`}>
          {saving ? <Loader2 size={14} className="animate-spin" /> :
           saved   ? <Check size={14} /> : <Plus size={14} />}
        </button>
      </div>

      {/* Info principal */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-base font-bold text-dark leading-tight">{recipe.name}</h3>
          <DifficultyStars level={recipe.difficulty} />
        </div>

        {/* Macros chips */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <MacroChip icon={<Flame size={10} />} value={recipe.calories} unit="kcal" color="text-amber-600 bg-amber-50" />
          <MacroChip icon={<Beef size={10} />}  value={recipe.proteinG} color="text-red-600 bg-red-50" />
          <MacroChip icon={<Wheat size={10} />} value={recipe.carbsG}   color="text-orange-600 bg-orange-50" />
          <MacroChip icon={<Droplet size={10}/>}value={recipe.fatG}     color="text-blue-600 bg-blue-50" />
        </div>

        {/* Meta info */}
        <div className="flex items-center gap-3 text-xs text-slate-400 mb-3">
          <span className="flex items-center gap-1"><Timer size={11} />{totalMin} min</span>
          <span className={`px-2 py-0.5 rounded-full font-medium text-xs ${diff.color}`}>{diff.label}</span>
          <span>{recipe.servings} {recipe.servings === 1 ? 'porción' : 'porciones'}</span>
        </div>

        {/* Why recommended */}
        <p className="text-xs text-slate-500 leading-relaxed mb-3 italic">
          💡 {recipe.whyRecommended}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-3">
          {recipe.tags.map(tag => (
            <span key={tag} className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
              #{tag}
            </span>
          ))}
        </div>

        {/* Expand toggle */}
        <button onClick={() => setExpanded(e => !e)}
          className="flex items-center justify-center gap-1.5 w-full py-2 text-xs font-medium text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
          {expanded ? <><ChevronUp size={13} />Ocultar receta</> : <><ChevronDown size={13} />Ver receta completa</>}
        </button>

        {/* Expanded: ingredients + steps + tips */}
        {expanded && (
          <div className="mt-3 space-y-4 border-t border-slate-100 pt-4">
            {/* Ingredients */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <ShoppingCart size={13} className="text-brand-600" />
                <h4 className="text-xs font-semibold text-dark uppercase tracking-wide">Ingredientes</h4>
              </div>
              <div className="space-y-1.5">
                {recipe.ingredients.map((ing, i) => (
                  <div key={i} className="flex items-start justify-between gap-2 text-xs">
                    <div className="flex items-start gap-1.5">
                      <span className="text-slate-300 mt-0.5">•</span>
                      <div>
                        <span className="text-dark font-medium">{ing.name}</span>
                        {ing.notes && <span className="text-slate-400 ml-1">({ing.notes})</span>}
                      </div>
                    </div>
                    <span className="text-slate-500 shrink-0 font-medium">{ing.amount}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Steps */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <ChefHat size={13} className="text-brand-600" />
                <h4 className="text-xs font-semibold text-dark uppercase tracking-wide">Preparación</h4>
              </div>
              <div className="space-y-2.5">
                {recipe.steps.map((step) => (
                  <div key={step.step} className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {step.step}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-slate-700 leading-relaxed">{step.text}</p>
                      {step.minutes > 0 && (
                        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                          <Timer size={9} />{step.minutes} min
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tips */}
            {recipe.tips.length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                <p className="text-xs font-semibold text-amber-700 mb-1.5">✨ Tips del chef</p>
                <ul className="space-y-1">
                  {recipe.tips.map((tip, i) => (
                    <li key={i} className="text-xs text-amber-600 flex items-start gap-1.5">
                      <span className="shrink-0">•</span>{tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ════════════════════════════════════════════════════════════════════════

export default function MealRecommendationsPage() {
  const [mode, setMode]   = useState<'complete_day' | 'full_plan'>('complete_day')
  const [style, setStyle] = useState<'colombian' | 'flexible' | 'both'>('both')
  const [result, setResult] = useState<MealRecommendationResult | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: () => mealRecommendationApi.get({ mode, style }).then(r => r.data.data),
    onSuccess: (data) => setResult(data as MealRecommendationResult),
    onError: () => toast.error('Error generando recomendaciones — intenta de nuevo'),
  })

  const saveRecipe = async (recipe: Recipe) => {
    await mealApi.create({
      name:     recipe.name,
      mealType: recipe.mealType,
      calories: recipe.calories,
      proteinG: recipe.proteinG,
      carbsG:   recipe.carbsG,
      fatG:     recipe.fatG,
      source:   'MANUAL',
    })
  }

  // Barras de progreso macro
  const consumed = result?.consumed
  const targets  = result?.targets

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-dark flex items-center gap-2">
          <Sparkles size={20} className="text-amber-500" />
          ¿Qué como hoy?
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Recetas personalizadas basadas en tus macros y objetivo fitness
        </p>
      </div>

      {/* Config panel */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        {/* Mode */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">¿Qué necesitas?</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setMode('complete_day')}
              className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all
                ${mode === 'complete_day' ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}>
              <Utensils size={16} className={mode === 'complete_day' ? 'text-brand-600' : 'text-slate-400'} />
              <div>
                <p className={`text-sm font-medium ${mode === 'complete_day' ? 'text-brand-700' : 'text-dark'}`}>
                  Completar el día
                </p>
                <p className="text-xs text-slate-400">Según lo que ya comiste</p>
              </div>
            </button>
            <button onClick={() => setMode('full_plan')}
              className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all
                ${mode === 'full_plan' ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}>
              <BookOpen size={16} className={mode === 'full_plan' ? 'text-brand-600' : 'text-slate-400'} />
              <div>
                <p className={`text-sm font-medium ${mode === 'full_plan' ? 'text-brand-700' : 'text-dark'}`}>
                  Plan completo
                </p>
                <p className="text-xs text-slate-400">Desayuno, almuerzo, cena</p>
              </div>
            </button>
          </div>
        </div>

        {/* Style */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Estilo de cocina</p>
          <div className="flex gap-2">
            {[
              { key: 'colombian', label: '🇨🇴 Colombiana' },
              { key: 'flexible',  label: '🌍 Internacional' },
              { key: 'both',      label: '✨ Todo' },
            ].map(s => (
              <button key={s.key} onClick={() => setStyle(s.key as typeof style)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors
                  ${style === s.key ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <button onClick={() => mutate()} disabled={isPending}
          className="w-full bg-brand-600 text-white rounded-xl py-3 font-semibold hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
          {isPending
            ? <><Loader2 size={16} className="animate-spin" />Generando recetas...</>
            : <><Sparkles size={16} />Generar recomendaciones</>}
        </button>
      </div>

      {/* Loading skeleton */}
      {isPending && (
        <div className="space-y-4">
          <div className="h-4 bg-slate-100 rounded animate-pulse w-48" />
          <div className="grid sm:grid-cols-2 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <div className="h-48 bg-slate-100 animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2" />
                  <div className="flex gap-2">
                    <div className="h-6 w-16 bg-slate-100 rounded-full animate-pulse" />
                    <div className="h-6 w-14 bg-slate-100 rounded-full animate-pulse" />
                    <div className="h-6 w-12 bg-slate-100 rounded-full animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {result && !isPending && (
        <div className="space-y-5">
          {/* Summary banner */}
          <div className="bg-gradient-to-r from-brand-600 to-brand-500 rounded-xl p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{result.summary}</p>
                <p className="text-brand-100 text-xs mt-0.5">
                  {result.recipes.length} recetas · {mode === 'complete_day' ? 'para completar el día' : 'plan completo del día'}
                </p>
              </div>
              <button onClick={() => mutate()}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
                <RefreshCw size={15} />
              </button>
            </div>
          </div>

          {/* Macro progress (solo modo complete_day) */}
          {mode === 'complete_day' && consumed && targets && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Macros consumidos hoy</p>
              <div className="space-y-2.5">
                {[
                  { label: 'Calorías', val: consumed.calories, target: targets.calories, color: '#F59E0B', unit: 'kcal' },
                  { label: 'Proteína', val: consumed.proteinG, target: targets.proteinG, color: '#A32D2D', unit: 'g' },
                  { label: 'Carbos',   val: consumed.carbsG,   target: targets.carbsG,   color: '#854F0B', unit: 'g' },
                  { label: 'Grasa',    val: consumed.fatG,     target: targets.fatG,     color: '#185FA5', unit: 'g' },
                ].map(({ label, val, target, color, unit }) => {
                  const pct = target ? Math.min(Math.round((val / target) * 100), 100) : 0
                  return (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-500">{label}</span>
                        <span className="text-slate-600 font-medium">
                          {Math.round(val)}{unit} / {Math.round(target || 0)}{unit} ({pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Recipe cards grid */}
          <div className="grid sm:grid-cols-2 gap-4">
            {result.recipes.map(recipe => (
              <RecipeCard key={recipe.id} recipe={recipe} onSave={saveRecipe} />
            ))}
          </div>

          {/* Footer note */}
          <p className="text-xs text-slate-400 text-center pb-4">
            Los valores nutricionales son estimaciones. Toca <Plus size={10} className="inline" /> en una receta para agregarla a tu log de comidas del día.
          </p>
        </div>
      )}

      {/* Empty state */}
      {!result && !isPending && (
        <div className="text-center py-16">
          <ChefHat size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Configura tu preferencia y toca "Generar recomendaciones"</p>
          <p className="text-slate-300 text-xs mt-1">
            Gemini analizará tus macros del día y tu objetivo para sugerirte lo mejor
          </p>
        </div>
      )}
    </div>
  )
}
