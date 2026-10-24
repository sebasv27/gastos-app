// public/sw.js — Service worker básico para instalación PWA
const CACHE = 'gastos-app-v1'

self.addEventListener('install', (e) => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim())
})

// Network-first: siempre intenta traer datos frescos, cae a cache si no hay red
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith('http')) return

  if (e.request.method !== 'GET') return
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const resClone = res.clone()
        caches.open(CACHE).then((cache) => cache.put(e.request, resClone))
        return res
      })
      .catch(() => caches.match(e.request))
  )
})
