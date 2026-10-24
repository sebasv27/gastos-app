// src/pages/TransactionsPage.tsx  —  Fase 2
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Trash2, Download, Search, Plus, Filter,
  Camera, Pencil, Check, X as XIcon, ChevronLeft, ChevronRight
} from 'lucide-react'
import toast from 'react-hot-toast'
import { transactionApi, categoryApi } from '../services/api'
import { fmtCOP, fmtDate } from '../utils/format'
import { Category, Transaction } from '../types'
import AddTransactionModal from '../components/forms/AddTransactionModal'

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  MANUAL:       { label: 'Manual',   cls: 'bg-slate-100 text-slate-500' },
  NOTIFICATION: { label: 'Banco',    cls: 'bg-blue-50 text-blue-600' },
  RECEIPT_OCR:  { label: '📸 OCR',   cls: 'bg-purple-50 text-purple-600' },
  IMPORT:       { label: 'Importado',cls: 'bg-amber-50 text-amber-600' },
}

export default function TransactionsPage() {
  const qc = useQueryClient()
  const [page, setPage]           = useState(1)
  const [search, setSearch]       = useState('')
  const [categoryId, setCatId]    = useState('')
  const [type, setType]           = useState('')
  const [showFilters, setFilters] = useState(false)
  const [showAdd, setShowAdd]     = useState(false)
  const [editId, setEditId]       = useState<string | null>(null)
  const [editAmount, setEditAmt]  = useState('')
  const [editDesc, setEditDesc]   = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', page, search, categoryId, type],
    queryFn: () => transactionApi.list({
      page, limit: 25,
      ...(search     && { search }),
      ...(categoryId && { categoryId }),
      ...(type       && { type }),
    }).then(r => r.data)
  })

  const { data: catData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryApi.list().then(r => r.data.data)
  })
  const categories: Category[] = catData || []

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['transactions'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
    qc.invalidateQueries({ queryKey: ['budgets'] })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este gasto?')) return
    try {
      await transactionApi.remove(id)
      toast.success('Eliminado')
      refresh()
    } catch { toast.error('Error al eliminar') }
  }

  const startEdit = (t: Transaction) => {
    setEditId(t.id)
    setEditAmt(String(t.amount))
    setEditDesc(t.description)
  }

  const saveEdit = async (t: Transaction) => {
    try {
      await transactionApi.update(t.id, {
        amount:      parseFloat(editAmount),
        description: editDesc,
      })
      toast.success('Actualizado')
      setEditId(null)
      refresh()
    } catch { toast.error('Error al actualizar') }
  }

  const handleExport = async () => {
    try {
      const res = await transactionApi.exportCSV()
      const url = URL.createObjectURL(new Blob([res.data]))
      const a   = document.createElement('a')
      a.href = url; a.download = 'gastos.csv'; a.click()
    } catch { toast.error('Error al exportar') }
  }

  const transactions: Transaction[] = data?.data || []
  const pagination = data?.pagination

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-dark">Gastos</h1>
          {pagination && (
            <p className="text-xs text-slate-400 mt-0.5">{pagination.total} registros</p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setFilters(f => !f)}
            className={`flex items-center gap-1.5 border rounded-lg px-3 py-2 text-sm transition-colors
              ${showFilters ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            <Filter size={14} /> Filtros
          </button>
          <button onClick={handleExport}
            className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
            <Download size={14} /> Exportar
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-brand-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-brand-700">
            <Plus size={14} /> Nuevo
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Buscar por descripción..."
          className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        />
      </div>

      {/* Filters row */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 p-4 bg-white border border-slate-200 rounded-xl">
          <select value={categoryId} onChange={e => { setCatId(e.target.value); setPage(1) }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="">Todas las categorías</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={type} onChange={e => { setType(e.target.value); setPage(1) }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="">Todos los tipos</option>
            <option value="EXPENSE">Gastos</option>
            <option value="INCOME">Ingresos</option>
            <option value="TRANSFER">Transferencias</option>
          </select>
          <button onClick={() => { setCatId(''); setType(''); setSearch(''); setPage(1) }}
            className="text-xs text-slate-400 hover:text-slate-600 underline px-2">
            Limpiar filtros
          </button>
        </div>
      )}

      {/* Transaction list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-10 text-center">
            <Camera size={32} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No hay gastos registrados</p>
            <button onClick={() => setShowAdd(true)}
              className="mt-3 text-brand-600 text-sm font-medium hover:underline">
              Registrar primer gasto →
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {transactions.map(t => {
              const isEditing = editId === t.id
              const badge     = SOURCE_BADGE[t.source] || SOURCE_BADGE.MANUAL
              return (
                <div key={t.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group">
                  {/* Category dot */}
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: t.category?.color || '#94a3b8' }}>
                    {t.category?.name?.[0] || '?'}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editDesc}
                        onChange={e => setEditDesc(e.target.value)}
                        className="text-sm font-medium text-dark w-full border-b border-brand-400 focus:outline-none bg-transparent pb-0.5"
                      />
                    ) : (
                      <p className="text-sm font-medium text-dark truncate">{t.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-slate-400">{t.category?.name || 'Sin categoría'}</p>
                      <span className="text-slate-200">·</span>
                      <p className="text-xs text-slate-400">{fmtDate(t.date)}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="shrink-0 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editAmount}
                        onChange={e => setEditAmt(e.target.value)}
                        className="w-28 text-sm font-semibold text-right border-b border-brand-400 focus:outline-none bg-transparent pb-0.5"
                      />
                    ) : (
                      <span className={`text-sm font-semibold ${
                        t.type === 'EXPENSE' ? 'text-red-600' : 'text-brand-600'
                      }`}>
                        {t.type === 'EXPENSE' ? '-' : '+'}{fmtCOP(t.amount)}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isEditing ? (
                      <>
                        <button onClick={() => saveEdit(t)}
                          className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg">
                          <Check size={14} />
                        </button>
                        <button onClick={() => setEditId(null)}
                          className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
                          <XIcon size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(t)}
                          className="p-1.5 text-slate-300 hover:text-brand-600 hover:bg-brand-50 rounded-lg">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(t.id)}
                          className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30">
            <ChevronLeft size={18} />
          </button>
          {Array.from({ length: Math.min(pagination.pages, 7) }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors
                ${p === page ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
              {p}
            </button>
          ))}
          <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}
            className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30">
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {showAdd && (
        <AddTransactionModal
          onClose={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); refresh() }}
        />
      )}
    </div>
  )
}
