// public/sw.js — Service worker: caché network-first + notificaciones push
const CACHE = 'gastos-app-v2'

self.addEventListener('install', () => { self.skipWaiting() })

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    await self.clients.claim()
  })())
})

// Network-first: siempre intenta traer datos frescos y cae a la caché si no hay red.
// Las llamadas a /api no se guardan en caché (son datos personales y cambian todo el tiempo).
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith('http')) return
  const url = new URL(e.request.url)
  if (url.pathname.startsWith('/api/')) return
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copia = res.clone()
        caches.open(CACHE).then((cache) => cache.put(e.request, copia))
        return res
      })
      .catch(() => caches.match(e.request))
  )
})

// ---------- Notificaciones push ----------
self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch { d = { body: e.data ? e.data.text() : '' } }
  e.waitUntil(self.registration.showNotification(d.title || 'Control de Gastos', {
    body: d.body || '',
    icon: d.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: d.tag,
    renotify: !!d.tag,
    data: { url: d.url || '/' },
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const destino = (e.notification.data && e.notification.data.url) || '/'
  e.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of ventanas) {
      if ('focus' in c) {
        try { await c.navigate(destino) } catch {}
        return c.focus()
      }
    }
    return self.clients.openWindow(destino)
  })())
})
