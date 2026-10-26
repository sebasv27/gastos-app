import { useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Upload, FileUp, Lock, CheckCircle2, AlertTriangle, ArrowLeftRight, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../services/api'

type Tipo = 'INCOME' | 'EXPENSE' | 'TRANSFER'
interface Fila {
  id: number; date: string; description: string; amount: number; type: Tipo
  categoryId: string | null; duplicate: string | null; selected: boolean
}
interface Preview {
  bank: string; period: { from: string; to: string } | null; method: 'exacto' | 'ia' | 'tabla'
  check: { abonosOk: boolean | null; cargosOk: boolean | null; leido: { abonos: number; cargos: number }; extracto: { abonos: number | null; cargos: number | null } } | null
  rows: Fila[]
}
interface Categoria { id: string; name: string }

const fmt = (n: number) => `$ ${Math.round(n || 0).toLocaleString('es-CO')}`
const fecha = (d: string) => d.slice(8, 10) + '/' + d.slice(5, 7)
const errorDe = (e: unknown) => (e as { response?: { data?: { error?: string; needsPassword?: boolean } } })?.response?.data

export default function ImportPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [pidePassword, setPidePassword] = useState(false)
  const [leyendo, setLeyendo] = useState(false)
  const [importando, setImportando] = useState(false)
  const [prev, setPrev] = useState<Preview | null>(null)
  const [filas, setFilas] = useState<Fila[]>([])

  const { data: categorias = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then(r => {
      const d = r.data?.data ?? r.data
      return (Array.isArray(d) ? d : []) as Categoria[]
    }),
  })

  const esPdf = !!archivo && archivo.name.toLowerCase().endsWith('.pdf')

  const leer = async () => {
    if (!archivo) return
    setLeyendo(true)
    try {
      const fd = new FormData()
      fd.append('file', archivo)
      if (password) fd.append('password', password)
      const r = await api.post('/imports/preview', fd, { timeout: 180000 })
      const p = r.data.data as Preview
      setPrev(p)
      setFilas(p.rows)
      setPassword('')
    } catch (e) {
      const d = errorDe(e)
      if (d?.needsPassword) setPidePassword(true)
      toast.error(d?.error || 'No se pudo leer el extracto')
    } finally {
      setLeyendo(false)
    }
  }

  const cambiar = (id: number, patch: Partial<Fila>) =>
    setFilas(fs => fs.map(f => (f.id === id ? { ...f, ...patch } : f)))
  const todas = (v: boolean) => setFilas(fs => fs.map(f => ({ ...f, selected: v })))

  const seleccion = filas.filter(f => f.selected)
  const resumen = useMemo(() => ({
    gastos: seleccion.filter(f => f.type === 'EXPENSE').reduce((s, f) => s + f.amount, 0),
    ingresos: seleccion.filter(f => f.type === 'INCOME').reduce((s, f) => s + f.amount, 0),
  }), [seleccion])

  const importar = async () => {
    if (!seleccion.length || !prev) return
    setImportando(true)
    try {
      const r = await api.post('/imports/commit', {
        bank: prev.bank,
        rows: seleccion.map(({ date, description, amount, type, categoryId }) => ({ date, description, amount, type, categoryId })),
      })
      toast.success(`${r.data.data.imported} movimientos importados`)
      qc.invalidateQueries()
      navigate('/gastos')
    } catch (e) {
      toast.error(errorDe(e)?.error || 'No se pudo importar')
    } finally {
      setImportando(false)
    }
  }

  const reiniciar = () => { setPrev(null); setFilas([]); setArchivo(null); setPidePassword(false); setPassword('') }

  // ---------- Paso 1: subir ----------
  if (!prev) {
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 flex items-center gap-2"><Upload size={20} className="text-brand-600" />Importar extracto</h1>
          <p className="text-sm text-slate-500">Sube el extracto de tu banco (PDF, CSV o Excel). Revisarás cada movimiento antes de guardarlo.</p>
        </div>

        <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <button onClick={() => inputRef.current?.click()}
            className="w-full border-2 border-dashed border-slate-200 hover:border-brand-500 rounded-2xl py-8 flex flex-col items-center gap-2 text-slate-500 transition-colors">
            <FileUp size={28} className="text-brand-600" />
            <span className="text-sm font-medium text-slate-700">{archivo ? archivo.name : 'Elegir archivo'}</span>
            <span className="text-xs text-slate-400">PDF, CSV o .xlsx · máximo 10 MB</span>
          </button>
          <input ref={inputRef} type="file" accept=".pdf,.csv,.txt,.xlsx" className="hidden"
            onChange={e => { setArchivo(e.target.files?.[0] || null); setPidePassword(false) }} />

          {(esPdf || pidePassword) && (
            <label className="block text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><Lock size={12} />Contraseña del PDF {pidePassword ? '(requerida)' : '(si tiene)'}</span>
              <input type="password" autoComplete="off" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Suele ser tu número de cédula"
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-600/30" />
              <span className="text-[11px] text-slate-400">Solo se usa para abrir el archivo; no se guarda.</span>
            </label>
          )}

          <button onClick={leer} disabled={!archivo || leyendo}
            className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50">
            {leyendo ? 'Leyendo extracto...' : 'Leer extracto'}
          </button>
          {leyendo && <p className="text-[11px] text-slate-400 text-center">Si el banco no tiene lector propio se usa IA, y puede tardar hasta un minuto.</p>}
        </section>

        <p className="text-[11px] text-slate-400">
          Bancolombia (ahorros y corriente) se lee con un lector exacto. Otros bancos se leen con IA: solo se envían las líneas con fecha y monto,
          sin números de cuenta ni datos personales.
        </p>
      </div>
    )
  }

  // ---------- Paso 2: revisar ----------
  const c = prev.check
  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">{prev.bank}</h1>
          <p className="text-sm text-slate-500">
            {prev.period ? `${prev.period.from} a ${prev.period.to} · ` : ''}{filas.length} movimientos
            {prev.method === 'ia' && <span className="ml-2 inline-flex items-center gap-1 text-violet-700"><Sparkles size={12} />leído con IA: revisa bien</span>}
          </p>
        </div>
        <button onClick={reiniciar} className="text-xs text-slate-500 hover:underline">Subir otro archivo</button>
      </div>

      {c && (c.abonosOk !== null || c.cargosOk !== null) && (
        (c.abonosOk !== false && c.cargosOk !== false) ? (
          <p className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">
            <CheckCircle2 size={16} />Los totales cuadran con el extracto: no se escapó ningún movimiento.
          </p>
        ) : (
          <p className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 rounded-xl px-3 py-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            Los totales no cuadran (leído: abonos {fmt(c.leido.abonos)}, cargos {fmt(c.leido.cargos)} · extracto: abonos {fmt(c.extracto.abonos || 0)}, cargos {fmt(c.extracto.cargos || 0)}). Puede faltar algún movimiento.
          </p>
        )
      )}

      <div className="flex flex-wrap gap-2 text-xs">
        <button onClick={() => todas(true)} className="px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50">Marcar todos</button>
        <button onClick={() => todas(false)} className="px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50">Desmarcar todos</button>
        <span className="px-3 py-1.5 text-slate-400">Duplicados y movimientos entre tus cuentas quedan desmarcados</span>
      </div>

      <ul className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
        {filas.map(f => (
          <li key={f.id} className={`px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 ${f.selected ? '' : 'opacity-60'}`}>
            <input type="checkbox" checked={f.selected} onChange={e => cambiar(f.id, { selected: e.target.checked })}
              className="w-4 h-4 accent-brand-600 shrink-0" />
            <span className="text-xs text-slate-400 w-10 shrink-0">{fecha(f.date)}</span>
            <div className="flex-1 min-w-[160px]">
              <p className="text-sm text-slate-800 truncate">{f.description}</p>
              {f.duplicate && <p className="text-[11px] text-amber-700">Posible duplicado de: {f.duplicate}</p>}
            </div>
            <select value={f.type} onChange={e => cambiar(f.id, { type: e.target.value as Tipo, categoryId: e.target.value === 'TRANSFER' ? null : f.categoryId })}
              className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700">
              <option value="EXPENSE">Gasto</option>
              <option value="INCOME">Ingreso</option>
              <option value="TRANSFER">Entre mis cuentas</option>
            </select>
            {f.type === 'TRANSFER' ? (
              <span className="text-xs text-slate-400 flex items-center gap-1 w-36"><ArrowLeftRight size={12} />No cuenta como gasto</span>
            ) : (
              <select value={f.categoryId || ''} onChange={e => cambiar(f.id, { categoryId: e.target.value || null })}
                className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 w-36">
                <option value="">Sin categoría</option>
                {categorias.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            )}
            <span className={`text-sm font-semibold tabular-nums w-28 text-right shrink-0 ${
              f.type === 'INCOME' ? 'text-emerald-600' : f.type === 'EXPENSE' ? 'text-red-600' : 'text-slate-400'}`}>
              {f.type === 'INCOME' ? '+' : f.type === 'EXPENSE' ? '-' : ''}{fmt(f.amount)}
            </span>
          </li>
        ))}
      </ul>

      <div className="fixed bottom-0 left-0 right-0 md:left-56 bg-white border-t border-slate-200 p-3">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {seleccion.length} seleccionados · gastos {fmt(resumen.gastos)} · ingresos {fmt(resumen.ingresos)}
          </p>
          <button onClick={importar} disabled={!seleccion.length || importando}
            className="px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50">
            {importando ? 'Importando...' : `Importar ${seleccion.length} movimientos`}
          </button>
        </div>
      </div>
    </div>
  )
}
