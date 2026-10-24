// src/pages/DevicePage.tsx  —  Fase 3
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Smartphone, Wifi, WifiOff, Activity,
  CheckCircle, Circle, ExternalLink, Copy, RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'
import { transactionApi } from '../services/api'
import { fmtCOP, fmtDate } from '../utils/format'
import { Transaction } from '../types'

const BANK_PACKAGES: Record<string, { name: string; color: string }> = {
  'com.bancolombia.decomposition': { name: 'Bancolombia',  color: '#FFCD00' },
  'com.nequi.mobileapp':           { name: 'Nequi',        color: '#9B59B6' },
  'com.davivienda.daviplataapp':    { name: 'Daviplata',    color: '#E74C3C' },
  'com.bbva.nativemobileapp':      { name: 'BBVA',         color: '#004A97' },
  'com.davivienda.movil':          { name: 'Davivienda',   color: '#C0392B' },
}

export default function DevicePage() {
  const [copied, setCopied] = useState(false)
  const serverUrl = window.location.origin

  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success('Copiado')
    setTimeout(() => setCopied(false), 2000)
  }

  // Últimas transacciones automáticas (source = NOTIFICATION)
  const { data: autoTxData, refetch, isFetching } = useQuery({
    queryKey: ['transactions-auto'],
    queryFn: () => transactionApi.list({ limit: 10, source: 'NOTIFICATION' } as Record<string, string | number>).then(r => r.data),
    refetchInterval: 15_000,
  })
  const autoTx: Transaction[] = autoTxData?.data || []

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-dark">Dispositivo Android</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Monitoreo automático de notificaciones bancarias
        </p>
      </div>

      {/* How it works */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-dark mb-4">¿Cómo funciona?</h2>
        <div className="space-y-3">
          {[
            { n: 1, text: 'Bancolombia o Nequi te envía una notificación push al hacer un pago' },
            { n: 2, text: 'La app Android la intercepta y manda el texto al servidor' },
            { n: 3, text: 'El servidor parsea el monto, detecta la categoría y lo guarda automáticamente' },
            { n: 4, text: 'El dashboard se actualiza en tiempo real — sin que toques nada' },
          ].map(({ n, text }) => (
            <div key={n} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {n}
              </div>
              <p className="text-sm text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Setup steps */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-dark mb-4">Configuración en 3 pasos</h2>
        <div className="space-y-5">

          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <Smartphone size={16} className="text-slate-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-dark">Instala la app Android</p>
              <p className="text-xs text-slate-400 mt-0.5 mb-2">
                Descarga el APK desde el archivo del proyecto en la carpeta <code className="bg-slate-100 px-1 rounded">android/</code>
              </p>
              <div className="flex gap-2">
                <a href="https://developer.android.com/studio" target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-brand-600 hover:underline">
                  <ExternalLink size={11} />Cómo generar el APK con Android Studio
                </a>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <Wifi size={16} className="text-slate-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-dark">Ingresa la URL del servidor</p>
              <p className="text-xs text-slate-400 mt-0.5 mb-2">
                Copia esta URL en la app Android
              </p>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <code className="text-xs text-dark flex-1 break-all">{serverUrl}</code>
                <button onClick={() => copy(serverUrl)}
                  className="text-slate-400 hover:text-brand-600 transition-colors shrink-0">
                  {copied ? <CheckCircle size={14} className="text-brand-600" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <CheckCircle size={16} className="text-slate-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-dark">Activa el permiso de notificaciones</p>
              <p className="text-xs text-slate-400 mt-0.5">
                En Android: <strong>Ajustes → Aplicaciones → Acceso especial → Acceso a notificaciones</strong> → activa "Control de Gastos"
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bancos monitoreados */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-dark mb-3">Bancos monitoreados</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(BANK_PACKAGES).map(([pkg, { name, color }]) => (
            <div key={pkg} className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-100">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-xs text-slate-700 font-medium">{name}</span>
              <Circle size={8} className="text-brand-500 fill-brand-500 ml-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* Live feed */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Activity size={15} className="text-brand-600" />
            <h2 className="text-sm font-semibold text-dark">Transacciones automáticas recientes</h2>
          </div>
          <button onClick={() => refetch()}
            className={`p-1.5 rounded-lg hover:bg-slate-100 transition-colors ${isFetching ? 'animate-spin' : ''}`}>
            <RefreshCw size={14} className="text-slate-400" />
          </button>
        </div>

        {autoTx.length === 0 ? (
          <div className="py-12 text-center">
            <WifiOff size={32} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Sin transacciones automáticas todavía</p>
            <p className="text-slate-300 text-xs mt-1">
              Aparecerán aquí cuando hagas un pago con Bancolombia o Nequi
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {autoTx.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: t.category?.color || '#94a3b8' }}>
                  {t.category?.name?.[0] || '🏦'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-dark truncate">{t.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-400">{t.category?.name || 'Sin categoría'}</span>
                    <span className="text-slate-200">·</span>
                    <span className="text-xs text-slate-400">{fmtDate(t.date)}</span>
                    <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">Auto</span>
                  </div>
                </div>
                <span className="text-sm font-semibold text-red-600 shrink-0">
                  -{fmtCOP(t.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
