// FrameX LeadFlow service worker  --  minimal offline shell cache
const CACHE = 'framex-leadflow-v1'
const SHELL = ['/', '/manifest.json']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  // Never cache API/uploads; let network handle so offline queue triggers
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) {
    return
  }
  // Cache-first for shell/static
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached
      return fetch(req).then((res) => {
        if (req.method === 'GET' && res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => {})
        }
        return res
      }).catch(() => caches.match('/'))
    })
  )
})
