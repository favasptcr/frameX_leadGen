// FrameX LeadFlow service worker  --  minimal offline shell cache
const CACHE = 'framex-leadflow-v2'
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
  // Next.js build assets are content-hashed (filename changes when content
  // changes), so they're safe to cache-first forever. Everything else
  // (the shell, manifest, /public icons) can be overwritten in place on a
  // deploy without a filename change, so those must go network-first or a
  // device that cached them once would serve stale bytes indefinitely.
  const isHashedBuildAsset = url.pathname.startsWith('/_next/static/')

  if (isHashedBuildAsset) {
    e.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        if (req.method === 'GET' && res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => {})
        }
        return res
      }))
    )
    return
  }

  e.respondWith(
    fetch(req).then((res) => {
      if (req.method === 'GET' && res.ok) {
        const clone = res.clone()
        caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => {})
      }
      return res
    }).catch(() => caches.match(req).then((cached) => cached || caches.match('/')))
  )
})
