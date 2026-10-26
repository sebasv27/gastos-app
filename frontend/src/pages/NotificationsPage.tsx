import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BellRing, BellOff, Send, Share, PlusSquare, Smartphone } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../services/api'

type Clave = 'budget' | 'habits' | 'debts' | 'gym' | 'weekly'
type Prefs = Record<Clave, boolean> & { devices: number }

const TIPOS: { key: Clave; title: string; desc: string }[] = [
  { key: 'budget', title: 'Presupuestos', desc: 'Cuando llegas al límite de alerta o superas el presupuesto de una categoría.' },
  { key: 'habits', title: 'Hábitos', desc: 'A la hora del recordatorio de cada hábito, si aún no lo has marcado.' },
  { key: 'debts', title: 'Pagos de deudas', desc: 'Un día antes de la fecha de pago, a las 8 a. m.' },
  { key: 'gym', title: 'Récords en el gym', desc: 'Cuando superas una marca personal.' },
  { key: 'weekly', title: 'Resumen semanal', desc: 'Los domingos en la noche: gastos, entrenos y hábitos de la semana.' },
]

const errorMsg = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(Array.from(raw).map(c => c.charCodeAt(0)))
}

const soportado = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
const esIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent)
const esStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true

function Switch({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)}
      className={`relative w-10 h-6 rounded-full transition-colors shrink-0 disabled:opacity-40 ${on ? 'bg-brand-600' : 'bg-slate-300'}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : ''}`} />
    </button>
  )
}

export default function NotificationsPage() {
  const qc = useQueryClient()
  const [permiso, setPermiso] = useState<NotificationPermission | 'unsupported'>(
    soportado() ? Notification.permission : 'unsupported')
  const [suscrito, setSuscrito] = useState(false)
  const [cargando, setCargando] = useState(false)

  const { data: prefs } = useQuery({
    queryKey: ['push-prefs'],
    queryFn: () => api.get('/push/prefs').then(r => r.data.data as Prefs),
  })

  useEffect(() => {
    if (!soportado()) return
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(s => setSuscrito(!!s))
      .catch(() => {})
  }, [])

  const activar = async () => {
    setCargando(true)
    try {
      const p = await Notification.requestPermission()
      setPermiso(p)
      if (p !== 'granted') { toast.error('Necesitas permitir las notificaciones en el navegador'); return }
      const key = await api.get('/push/public-key').then(r => r.data.data as string)
      const reg = await navigator.serviceWorker.ready
      const sub = (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key) as unknown as BufferSource,
        }))
      await api.post('/push/subscribe', { subscription: sub.toJSON(), userAgent: navigator.userAgent })
      setSuscrito(true)
      qc.invalidateQueries({ queryKey: ['push-prefs'] })
      toast.success('Notificaciones activadas en este dispositivo')
    } catch (e) {
      toast.error(errorMsg(e, 'No se pudieron activar las notificaciones'))
    } finally {
      setCargando(false)
    }
  }

  const desactivar = async () => {
    setCargando(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const s = await reg.pushManager.getSubscription()
      if (s) {
        await api.post('/push/unsubscribe', { endpoint: s.endpoint }).catch(() => {})
        await s.unsubscribe()
      }
      setSuscrito(false)
      qc.invalidateQueries({ queryKey: ['push-prefs'] })
      toast.success('Notificaciones desactivadas en este dispositivo')
    } catch (e) {
      toast.error(errorMsg(e, 'No se pudieron desactivar'))
    } finally {
      setCargando(false)
    }
  }

  const probar = async () => {
    try { await api.post('/push/test'); toast.success('Enviada. Debería llegarte en unos segundos.') }
    catch (e) { toast.error(errorMsg(e, 'No se pudo enviar la prueba')) }
  }

  const cambiar = async (k: Clave, v: boolean) => {
    qc.setQueryData(['push-prefs'], (old: Prefs | undefined) => (old ? { ...old, [k]: v } : old))
    try { await api.put('/push/prefs', { [k]: v }) }
    catch { toast.error('No se pudo guardar'); qc.invalidateQueries({ queryKey: ['push-prefs'] }) }
  }

  const iosSinInstalar = esIOS() && !esStandalone()

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
          <BellRing size={20} className="text-brand-600" />Notificaciones
        </h1>
        <p className="text-sm text-slate-500">Avisos en tu celular o computador, aunque la app esté cerrada.</p>
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5"><Smartphone size={15} />Este dispositivo</p>

        {iosSinInstalar ? (
          <div className="text-sm text-slate-600 space-y-2">
            <p>En iPhone las notificaciones solo funcionan con la app instalada en la pantalla de inicio (iOS 16.4 o superior):</p>
            <ol className="space-y-1.5 text-sm">
              <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-slate-100 text-xs flex items-center justify-center">1</span>
                Toca <Share size={14} className="inline" /> Compartir en Safari.</li>
              <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-slate-100 text-xs flex items-center justify-center">2</span>
                Elige <PlusSquare size={14} className="inline" /> "Agregar a pantalla de inicio".</li>
              <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-slate-100 text-xs flex items-center justify-center">3</span>
                Abre la app desde ese ícono y vuelve a esta página.</li>
            </ol>
          </div>
        ) : permiso === 'unsupported' ? (
          <p className="text-sm text-slate-500">Este navegador no soporta notificaciones push. Prueba con Chrome, Edge o Firefox.</p>
        ) : permiso === 'denied' ? (
          <p className="text-sm text-amber-700 bg-amber-50 rounded-xl p-3">
            Bloqueaste las notificaciones para este sitio. Habilítalas desde el candado junto a la dirección
            (Configuración del sitio → Notificaciones → Permitir) y recarga la página.
          </p>
        ) : suscrito ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full">Activas en este dispositivo</span>
            <button onClick={probar} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">
              <Send size={13} />Enviar prueba
            </button>
            <button onClick={desactivar} disabled={cargando}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              <BellOff size={13} />Desactivar aquí
            </button>
          </div>
        ) : (
          <button onClick={activar} disabled={cargando}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50">
            <BellRing size={15} />{cargando ? 'Activando...' : 'Activar notificaciones'}
          </button>
        )}

        {prefs && (
          <p className="text-[11px] text-slate-400">
            {prefs.devices === 0 ? 'Ningún dispositivo suscrito todavía.' : `${prefs.devices} dispositivo(s) suscrito(s).`} Actívalas en cada celular o computador donde las quieras.
          </p>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
        {TIPOS.map(t => (
          <div key={t.key} className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800">{t.title}</p>
              <p className="text-xs text-slate-400">{t.desc}</p>
            </div>
            <Switch on={prefs ? prefs[t.key] : true} disabled={!prefs} onChange={v => cambiar(t.key, v)} />
          </div>
        ))}
      </section>
    </div>
  )
}
