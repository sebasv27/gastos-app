// src/components/forms/AddTransactionModal.tsx
import { useState, useRef, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Camera, Keyboard, Zap, Upload, CheckCircle, AlertCircle, Loader2, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { categoryApi, transactionApi, ocrApi } from '../../services/api'
import { Category } from '../../types'

interface Props { onClose: () => void; onSuccess: () => void }

type Mode = 'quick' | 'manual' | 'camera'

interface FormState {
  description: string
  amount: string
  categoryId: string
  type: 'EXPENSE' | 'INCOME' | 'TRANSFER'
  date: string
  notes: string
}

const QUICK_AMOUNTS = [5000, 10000, 20000, 50000, 100000, 200000]
const fmt = (n: number) => n.toLocaleString('es-CO')

export default function AddTransactionModal({ onClose, onSuccess }: Props) {
  const [mode, setMode] = useState<Mode>('quick')
  const [form, setForm] = useState<FormState>({
    description: '', amount: '', categoryId: '',
    type: 'EXPENSE', date: new Date().toISOString().split('T')[0], notes: ''
  })

  // OCR states
  const [ocrLoading, setOcrLoading]     = useState(false)
  const [ocrResult, setOcrResult]       = useState<null | { confidence: number; rawTotal: string }>(null)
  const [ocrError, setOcrError]         = useState<string | null>(null)
  const [previewUrl, setPreviewUrl]     = useState<string | null>(null)

  // Category suggest state
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestedCat, setSuggestedCat]     = useState<Category | null>(null)

  // Saving
  const [saving, setSaving] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const descTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: catData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryApi.list().then(r => r.data.data as Category[])
  })
  const categories: Category[] = catData || []

  const set = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }))

  // Auto-suggest category when description changes (debounced 800ms)
  const handleDescChange = (v: string) => {
    set('description', v)
    setSuggestedCat(null)
    if (descTimer.current) clearTimeout(descTimer.current)
    if (v.length < 3) return
    descTimer.current = setTimeout(async () => {
      setSuggestLoading(true)
      try {
        const res = await ocrApi.suggestCategory(v)
        if (res.data.data) {
          setSuggestedCat(res.data.data)
          if (!form.categoryId) set('categoryId', res.data.data.id)
        }
      } catch { /* silent fail */ }
      finally { setSuggestLoading(false) }
    }, 800)
  }

  const acceptSuggestion = () => {
    if (suggestedCat) { set('categoryId', suggestedCat.id); setSuggestedCat(null) }
  }

  // OCR processing
  const handleFile = useCallback(async (file: File) => {
    setOcrError(null)
    setOcrResult(null)
    setPreviewUrl(URL.createObjectURL(file))
    setOcrLoading(true)
    try {
      const res = await ocrApi.scanReceipt(file)
      const d   = res.data.data
      setForm(f => ({
        ...f,
        amount:      String(d.amount),
        description: d.description || d.merchant || f.description,
        date:        d.date || f.date,
        categoryId:  d.categoryId || f.categoryId,
        source:      'RECEIPT_OCR'
      } as FormState))
      setOcrResult({ confidence: d.confidence, rawTotal: d.rawTotal })
      if (d.confidence < 0.6)
        toast('Revisá los datos — el recibo no era del todo claro', { icon: '⚠️' })
      else
        toast.success('Recibo procesado correctamente')
      setMode('manual')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setOcrError(msg || 'No se pudo leer el recibo')
    } finally {
      setOcrLoading(false)
    }
  }, [])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const submit = async () => {
    if (!form.description) { toast.error('Ingresa una descripción'); return }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Ingresa un monto válido'); return }
    setSaving(true)
    try {
      await transactionApi.create({
        ...form,
        amount:     parseFloat(form.amount),
        categoryId: form.categoryId || undefined,
        source:     ocrResult ? 'RECEIPT_OCR' : 'MANUAL'
      })
      toast.success('¡Guardado!')
      onSuccess()
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const canSave = form.description.length > 0 && parseFloat(form.amount) > 0

  // ── UI helpers ─────────────────────────────────────────────────
  const tabClass = (m: Mode) =>
    `flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium transition-all
     ${mode === m
       ? 'bg-white shadow text-brand-700 ring-1 ring-brand-200'
       : 'text-slate-500 hover:text-slate-700'}`

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4 bg-black/50">
      <div className="bg-slate-50 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[95dvh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="font-semibold text-dark text-base">Registrar gasto</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="px-5 pb-3">
          <div className="flex gap-1.5 bg-slate-200/70 p-1 rounded-2xl">
            <button className={tabClass('quick')} onClick={() => setMode('quick')}>
              <Zap size={15} />Rápido
            </button>
            <button className={tabClass('manual')} onClick={() => setMode('manual')}>
              <Keyboard size={15} />Manual
            </button>
            <button className={tabClass('camera')} onClick={() => setMode('camera')}>
              <Camera size={15} />Recibo
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-5 pb-2">

          {/* ── QUICK MODE ─────────────────────────────────────── */}
          {mode === 'quick' && (
            <div className="space-y-4">
              {/* Amount big input */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200">
                <label className="text-xs text-slate-400 mb-1 block">Monto</label>
                <div className="flex items-center gap-1">
                  <span className="text-2xl font-bold text-slate-400">$</span>
                  <input
                    autoFocus
                    type="number"
                    inputMode="numeric"
                    value={form.amount}
                    onChange={e => set('amount', e.target.value)}
                    placeholder="0"
                    className="flex-1 text-3xl font-bold text-dark bg-transparent focus:outline-none w-0 min-w-0"
                  />
                </div>
                {/* Quick amounts */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {QUICK_AMOUNTS.map(n => (
                    <button
                      key={n}
                      onClick={() => set('amount', String(n))}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
                        ${form.amount === String(n)
                          ? 'bg-brand-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      ${fmt(n)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200">
                <label className="text-xs text-slate-400 mb-1 block">¿En qué gastaste?</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => handleDescChange(e.target.value)}
                  placeholder="ej. Almuerzo, Uber, D1..."
                  className="w-full text-sm text-dark bg-transparent focus:outline-none"
                />
                {/* AI category suggestion */}
                {suggestLoading && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400">
                    <Loader2 size={11} className="animate-spin" />Sugiriendo categoría...
                  </div>
                )}
                {suggestedCat && !form.categoryId && (
                  <button
                    onClick={acceptSuggestion}
                    className="flex items-center gap-1.5 mt-2 text-xs text-brand-600 font-medium"
                  >
                    <Sparkles size={11} />
                    Categoría sugerida: {suggestedCat.name} — toca para aceptar
                  </button>
                )}
              </div>

              {/* Category chips */}
              <div>
                <p className="text-xs text-slate-400 mb-2">Categoría</p>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map(c => (
                    <button
                      key={c.id}
                      onClick={() => set('categoryId', c.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all
                        ${form.categoryId === c.id ? 'text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'}`}
                      style={form.categoryId === c.id ? { backgroundColor: c.color } : {}}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Type & date row */}
              <div className="flex gap-2">
                <div className="flex-1 bg-white rounded-xl border border-slate-200 p-3">
                  <label className="text-xs text-slate-400 mb-1 block">Tipo</label>
                  <select
                    value={form.type}
                    onChange={e => set('type', e.target.value as FormState['type'])}
                    className="w-full text-sm bg-transparent focus:outline-none text-dark"
                  >
                    <option value="EXPENSE">Gasto</option>
                    <option value="INCOME">Ingreso</option>
                    <option value="TRANSFER">Transferencia</option>
                  </select>
                </div>
                <div className="flex-1 bg-white rounded-xl border border-slate-200 p-3">
                  <label className="text-xs text-slate-400 mb-1 block">Fecha</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => set('date', e.target.value)}
                    className="w-full text-sm bg-transparent focus:outline-none text-dark"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── MANUAL MODE ────────────────────────────────────── */}
          {mode === 'manual' && (
            <div className="space-y-3">
              {/* OCR pre-fill banner */}
              {ocrResult && (
                <div className="flex items-start gap-2 bg-brand-50 border border-brand-200 rounded-xl p-3">
                  <CheckCircle size={15} className="text-brand-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-brand-700">
                    <p className="font-medium">Datos extraídos del recibo</p>
                    <p className="text-brand-500 mt-0.5">
                      Total leído: {ocrResult.rawTotal} · Confianza: {Math.round(ocrResult.confidence * 100)}%
                    </p>
                    <p className="text-brand-400 mt-0.5">Revisa y ajusta si es necesario.</p>
                  </div>
                </div>
              )}

              {/* Type toggle */}
              <div className="flex gap-1.5">
                {(['EXPENSE','INCOME','TRANSFER'] as const).map(t => (
                  <button key={t} onClick={() => set('type', t)}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors
                      ${form.type === t
                        ? t==='EXPENSE' ? 'bg-red-100 text-red-700'
                          : t==='INCOME' ? 'bg-brand-100 text-brand-700'
                          : 'bg-slate-200 text-slate-700'
                        : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                  >
                    {t==='EXPENSE'?'Gasto':t==='INCOME'?'Ingreso':'Transferencia'}
                  </button>
                ))}
              </div>

              {/* Amount */}
              <div className="bg-white rounded-xl border border-slate-200 p-3">
                <label className="text-xs text-slate-400 mb-1 block">Monto ($)</label>
                <input
                  type="number" inputMode="numeric"
                  value={form.amount}
                  onChange={e => set('amount', e.target.value)}
                  placeholder="0"
                  className="w-full text-2xl font-bold text-dark bg-transparent focus:outline-none"
                />
              </div>

              {/* Description with AI suggest */}
              <div className="bg-white rounded-xl border border-slate-200 p-3">
                <label className="text-xs text-slate-400 mb-1 block">Descripción</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => handleDescChange(e.target.value)}
                  placeholder="ej. Mercado La 14, Nequi Juan..."
                  className="w-full text-sm text-dark bg-transparent focus:outline-none"
                />
                {suggestLoading && (
                  <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
                    <Loader2 size={10} className="animate-spin" />Sugiriendo...
                  </p>
                )}
                {suggestedCat && (
                  <button onClick={acceptSuggestion}
                    className="flex items-center gap-1 mt-1.5 text-xs text-brand-600 font-medium">
                    <Sparkles size={10} />{suggestedCat.name} — aceptar sugerencia
                  </button>
                )}
              </div>

              {/* Category */}
              <div className="bg-white rounded-xl border border-slate-200 p-3">
                <label className="text-xs text-slate-400 mb-1 block">Categoría</label>
                <select
                  value={form.categoryId}
                  onChange={e => set('categoryId', e.target.value)}
                  className="w-full text-sm text-dark bg-transparent focus:outline-none"
                >
                  <option value="">Sin categoría</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Date + Notes */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white rounded-xl border border-slate-200 p-3">
                  <label className="text-xs text-slate-400 mb-1 block">Fecha</label>
                  <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                    className="w-full text-sm text-dark bg-transparent focus:outline-none" />
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-3">
                  <label className="text-xs text-slate-400 mb-1 block">Notas</label>
                  <input type="text" value={form.notes} onChange={e => set('notes', e.target.value)}
                    placeholder="opcional"
                    className="w-full text-sm text-dark bg-transparent focus:outline-none" />
                </div>
              </div>
            </div>
          )}

          {/* ── CAMERA MODE ────────────────────────────────────── */}
          {mode === 'camera' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 text-center">
                Foto a un recibo, comprobante de Nequi o factura.<br/>
                Claude extrae el monto, comercio y fecha automáticamente.
              </p>

              {/* Drop zone */}
              {!ocrLoading && !previewUrl && (
                <div
                  onDrop={handleDrop}
                  onDragOver={e => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-brand-400 rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors bg-white"
                >
                  <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center">
                    <Upload size={24} className="text-brand-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-dark">Sube o arrastra una foto</p>
                    <p className="text-xs text-slate-400 mt-1">JPG, PNG o WEBP · máx 8MB</p>
                  </div>
                  <button className="bg-brand-600 text-white px-5 py-2 rounded-xl text-sm font-medium flex items-center gap-2">
                    <Camera size={15} />Tomar / elegir foto
                  </button>
                </div>
              )}

              {/* Loading */}
              {ocrLoading && (
                <div className="rounded-2xl bg-white border border-slate-200 p-8 flex flex-col items-center gap-4">
                  {previewUrl && (
                    <img src={previewUrl} alt="Recibo" className="max-h-40 rounded-xl object-contain" />
                  )}
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={28} className="text-brand-500 animate-spin" />
                    <p className="text-sm font-medium text-dark">Leyendo recibo...</p>
                    <p className="text-xs text-slate-400">Claude está extrayendo los datos</p>
                  </div>
                </div>
              )}

              {/* Preview after OCR */}
              {previewUrl && !ocrLoading && (
                <div className="space-y-2">
                  <div className="rounded-2xl overflow-hidden border border-slate-200">
                    <img src={previewUrl} alt="Recibo" className="w-full max-h-48 object-contain bg-slate-50" />
                  </div>
                  {ocrError && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                      <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-red-700">{ocrError}</p>
                        <button
                          onClick={() => { setPreviewUrl(null); setOcrError(null) }}
                          className="text-xs text-red-500 underline mt-0.5"
                        >
                          Intentar con otra imagen
                        </button>
                      </div>
                    </div>
                  )}
                  {ocrResult && (
                    <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 text-xs text-brand-700">
                      <p className="font-medium">✓ Datos extraídos — revisa en la pestaña Manual</p>
                    </div>
                  )}
                  {!ocrError && (
                    <button
                      onClick={() => setMode('manual')}
                      className="w-full bg-brand-600 text-white py-2.5 rounded-xl text-sm font-medium"
                    >
                      Ver y confirmar datos →
                    </button>
                  )}
                </div>
              )}

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-slate-200 flex gap-2.5 bg-white rounded-b-2xl">
          <button
            onClick={onClose}
            className="flex-1 border border-slate-200 rounded-xl py-2.5 text-sm text-slate-600 hover:bg-slate-50 font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving || !canSave || mode === 'camera'}
            className="flex-1 bg-brand-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 size={15} className="animate-spin" />Guardando...</> : 'Guardar gasto'}
          </button>
        </div>
      </div>
    </div>
  )
}
