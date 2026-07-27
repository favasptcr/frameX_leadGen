'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { Toaster, toast } from 'sonner'
import {
  Camera, Plus, LogOut, LayoutDashboard, Users, Download, Settings as SettingsIcon,
  CloudOff, ArrowLeft, Phone, Mail, Globe, Archive, Search, Menu, Loader2,
  AlertTriangle, RefreshCw, Upload, Building2, Trash2,
} from 'lucide-react'

// ============================================================
// CONSTANTS
// ============================================================
const CUSTOMER_TYPES = [
  'Builder', 'General Contractor', 'Developer', 'Architect', 'Engineer',
  'Manufacturer', 'Supplier', 'Dealer or Distributor', 'Investor', 'Homeowner', 'Other',
]
const INTERESTS = [
  'Light-Gauge Steel Framing', 'Prefabricated Wall Panels', 'Steel Studs and Tracks',
  'Steel Framing Machine', 'Design and Engineering', 'Material Supply', 'Installation',
  'Contractor Partnership', 'Dealer or Distributor Opportunity', 'General Information', 'Other',
]
const TIMELINES = ['Immediate', 'Within 30 Days', 'Within 3 Months', 'Within 6 Months', 'Within 12 Months', 'Future Opportunity', 'Unknown']
const PRIORITIES = ['Hot', 'Warm', 'Cold']
const STATUSES = ['Not Contacted', 'Contacted', 'Follow-Up Scheduled', 'Qualified', 'Proposal Requested', 'Proposal Sent', 'Converted', 'Not Interested']

const PRIORITY_STYLES = {
  Hot: 'bg-red-100 text-red-800 border-red-200',
  Warm: 'bg-amber-100 text-amber-800 border-amber-200',
  Cold: 'bg-sky-100 text-sky-800 border-sky-200',
}

// ============================================================
// API HELPER
// ============================================================
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('lf_token') : null }
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  const t = getToken(); if (t) headers.Authorization = `Bearer ${t}`
  if (opts.body instanceof FormData) delete headers['Content-Type']
  const res = await fetch(`/api${path}`, { ...opts, headers })
  const ct = res.headers.get('content-type') || ''
  const data = ct.includes('application/json') ? await res.json() : await res.text()
  if (!res.ok) throw new Error((data && data.error) || 'Request failed')
  return data
}

// ============================================================
// IndexedDB OFFLINE QUEUE
// ============================================================
const IDB_NAME = 'framex_leadflow'
const IDB_STORE = 'offline_leads'
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
async function idbPut(item) {
  const db = await idbOpen()
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(item)
    tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error)
  })
}
async function idbAll() {
  const db = await idbOpen()
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).getAll()
    req.onsuccess = () => res(req.result || []); req.onerror = () => rej(req.error)
  })
}
async function idbDelete(id) {
  const db = await idbOpen()
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).delete(id)
    tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error)
  })
}

// ============================================================
// APP
// ============================================================
export default function App() {
  const [user, setUser] = useState(null)
  const [booting, setBooting] = useState(true)
  const [view, setView] = useState({ name: 'dashboard' })
  const [pendingCount, setPendingCount] = useState(0)
  const [online, setOnline] = useState(true)

  useEffect(() => {
    (async () => {
      if (typeof window !== 'undefined') setOnline(navigator.onLine)
      const t = getToken()
      if (t) {
        try { const { user } = await api('/auth/me'); setUser(user) } catch { localStorage.removeItem('lf_token') }
      }
      setBooting(false)
      refreshPending()
    })()
    const on = () => { setOnline(true); syncQueue() }
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  async function refreshPending() {
    try { const items = await idbAll(); setPendingCount(items.length) } catch { setPendingCount(0) }
  }

  async function syncQueue() {
    try {
      const items = await idbAll()
      for (const item of items) {
        try {
          await api('/leads', { method: 'POST', body: JSON.stringify(item) })
          await idbDelete(item.id)
        } catch (e) { console.warn('sync failed for', item.id, e) }
      }
      refreshPending()
    } catch (_e) { /* ignore */ }
  }

  useEffect(() => { if (user && online) syncQueue() }, [user, online])

  if (booting) {
    return <div className="min-h-screen grid place-items-center text-slate-500"><Loader2 className="animate-spin" /></div>
  }

  if (!user) return <LoginView onLogin={setUser} />

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar user={user} view={view} setView={setView} pendingCount={pendingCount} online={online}
        onLogout={() => { localStorage.removeItem('lf_token'); setUser(null); setView({ name: 'dashboard' }) }} />
      <main className="max-w-3xl mx-auto px-4 py-4 pb-24">
        {view.name === 'dashboard' && <Dashboard setView={setView} pendingCount={pendingCount} />}
        {view.name === 'new' && <NewLeadChoice setView={setView} />}
        {view.name === 'scan' && <ScanView setView={setView} user={user} refreshPending={refreshPending} online={online} />}
        {view.name === 'manual' && <ManualView setView={setView} user={user} refreshPending={refreshPending} online={online} initial={view.initial} cardImage={view.cardImage} ocrRaw={view.ocrRaw} />}
        {view.name === 'list' && <LeadsList setView={setView} />}
        {view.name === 'detail' && <LeadDetail id={view.id} setView={setView} user={user} />}
        {view.name === 'export' && <ExportView user={user} />}
        {view.name === 'settings' && <SettingsView user={user} />}
        {view.name === 'sync' && <SyncQueueView refreshPending={refreshPending} online={online} />}
      </main>

      {/* Sticky primary action */}
      {['dashboard', 'list'].includes(view.name) && (
        <div className="fixed bottom-4 left-0 right-0 px-4 z-40 pointer-events-none">
          <div className="max-w-3xl mx-auto flex justify-end pointer-events-auto">
            <Button size="lg" onClick={() => setView({ name: 'new' })}
              className="h-14 px-6 shadow-lg bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold rounded-full">
              <Camera className="w-5 h-5 mr-2" /> Scan New Lead
            </Button>
          </div>
        </div>
      )}
      <Toaster position="top-center" richColors />
    </div>
  )
}

// ============================================================
// TOP BAR
// ============================================================
function TopBar({ user, view, setView, pendingCount, online, onLogout }) {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView({ name: 'dashboard' })}>
          <img src="/icons/logo-mark.png" alt="FrameX" className="w-8 h-8 rounded" />
          <div>
            <div className="font-bold text-slate-900 leading-none">FrameX</div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 leading-none mt-0.5">LeadFlow</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!online && <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50"><CloudOff className="w-3 h-3 mr-1" />Offline</Badge>}
          {pendingCount > 0 && (
            <Badge className="bg-amber-500 hover:bg-amber-600 cursor-pointer" onClick={() => setView({ name: 'sync' })}>
              {pendingCount} pending
            </Badge>
          )}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon"><Menu className="w-5 h-5" /></Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <div className="mt-4 space-y-1">
                <div className="px-2 py-2">
                  <div className="text-sm font-semibold">{user.full_name}</div>
                  <div className="text-xs text-slate-500">{user.email}</div>
                  <Badge className="mt-2" variant="outline">{user.role.toUpperCase()}</Badge>
                </div>
                <Separator className="my-2" />
                <NavItem icon={LayoutDashboard} label="Dashboard" onClick={() => { setView({ name: 'dashboard' }); setOpen(false) }} />
                <NavItem icon={Users} label="Leads" onClick={() => { setView({ name: 'list' }); setOpen(false) }} />
                <NavItem icon={Camera} label="New Lead" onClick={() => { setView({ name: 'new' }); setOpen(false) }} />
                <NavItem icon={CloudOff} label={`Sync Queue${pendingCount ? ` (${pendingCount})` : ''}`} onClick={() => { setView({ name: 'sync' }); setOpen(false) }} />
                {user.role === 'admin' && <NavItem icon={Download} label="Export" onClick={() => { setView({ name: 'export' }); setOpen(false) }} />}
                <NavItem icon={SettingsIcon} label="Settings" onClick={() => { setView({ name: 'settings' }); setOpen(false) }} />
                <Separator className="my-2" />
                <NavItem icon={LogOut} label="Logout" onClick={onLogout} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
function NavItem({ icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-slate-100 text-slate-700">
      <Icon className="w-4 h-4" /> <span className="text-sm">{label}</span>
    </button>
  )
}

// ============================================================
// LOGIN
// ============================================================
function LoginView({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault(); setLoading(true)
    try {
      const { token, user } = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      localStorage.setItem('lf_token', token)
      onLogin(user)
      toast.success(`Welcome, ${user.full_name}`)
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }

  const isDev = process.env.NODE_ENV !== 'production'

  return (
    <div className="min-h-screen bg-slate-50 grid place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <img src="/icons/logo-mark.png" alt="FrameX" className="w-16 h-16 rounded-xl mb-3" />
          <h1 className="text-2xl font-bold text-slate-900">FrameX LeadFlow</h1>
          <p className="text-sm text-slate-500 mt-1">Lead capture for Houston Expo</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@framex.com" />
              </div>
              <div>
                <Label htmlFor="pw">Password</Label>
                <Input id="pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-11 bg-slate-900 hover:bg-slate-800">
                {loading ? <Loader2 className="animate-spin" /> : 'Sign In'}
              </Button>
            </form>
            {isDev && (
              <div className="mt-6 text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-md p-3">
                <div className="font-semibold text-amber-900 mb-1">Demo credentials (dev only)</div>
                <div>Admin: admin@framex.com / admin123</div>
                <div>Staff: staff@framex.com / staff123</div>
                <div className="mt-1 text-amber-800">Change passwords before production.</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ============================================================
// DASHBOARD
// ============================================================
function Dashboard({ setView, pendingCount }) {
  const [stats, setStats] = useState({ total: 0, today: 0, hot: 0, followUps: 0, recent: [] })
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const [s, e] = await Promise.all([api('/stats'), api('/events/active')])
        setStats(s); setEvent(e.event)
      } catch (err) { toast.error(err.message) } finally { setLoading(false) }
    })()
  }, [])

  return (
    <div className="space-y-4">
      {event && (
        <div className="bg-slate-900 text-white rounded-lg p-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-400">Active Event</div>
          <div className="text-lg font-semibold mt-1">{event.name}</div>
          <div className="text-sm text-slate-300">{event.venue} • Booth {event.booth_number}</div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total Leads" value={stats.total} />
        <StatCard label="Captured Today" value={stats.today} />
        <StatCard label="Hot Leads" value={stats.hot} accent="red" />
        <StatCard label="Follow-Ups Due" value={stats.followUps} accent="amber" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button onClick={() => setView({ name: 'scan' })} className="h-16 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold">
          <Camera className="w-5 h-5 mr-2" /> Scan Business Card
        </Button>
        <Button onClick={() => setView({ name: 'manual' })} variant="outline" className="h-16 border-slate-300 font-semibold">
          <Plus className="w-5 h-5 mr-2" /> Add Manually
        </Button>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Recent Leads</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading && <div className="text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>}
          {!loading && stats.recent.length === 0 && <div className="text-sm text-slate-500">No leads yet. Tap Scan New Lead to get started.</div>}
          {stats.recent.map((l) => (
            <div key={l.id} onClick={() => setView({ name: 'detail', id: l.id })} className="p-3 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900">{l.full_name || l.email || 'Unnamed'}</div>
                  <div className="text-xs text-slate-500">{l.company || '—'}</div>
                </div>
                <Badge className={PRIORITY_STYLES[l.priority] || ''} variant="outline">{l.priority}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ label, value, accent }) {
  const accentCls = accent === 'red' ? 'text-red-600' : accent === 'amber' ? 'text-amber-600' : 'text-slate-900'
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${accentCls}`}>{value}</div>
    </div>
  )
}

// ============================================================
// NEW LEAD CHOICE
// ============================================================
function NewLeadChoice({ setView }) {
  return (
    <div className="space-y-4">
      <BackButton onClick={() => setView({ name: 'dashboard' })} />
      <h2 className="text-xl font-bold">Add a New Lead</h2>
      <button onClick={() => setView({ name: 'scan' })} className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg p-6 text-left transition">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-slate-900 text-amber-400 rounded-lg grid place-items-center"><Camera className="w-6 h-6" /></div>
          <div>
            <div className="text-lg font-bold">Scan Business Card</div>
            <div className="text-sm opacity-80">Photograph a card, review, save</div>
          </div>
        </div>
      </button>
      <button onClick={() => setView({ name: 'manual' })} className="w-full bg-white border border-slate-200 hover:border-slate-400 rounded-lg p-6 text-left transition">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-lg grid place-items-center"><Plus className="w-6 h-6" /></div>
          <div>
            <div className="text-lg font-bold">Add Lead Manually</div>
            <div className="text-sm text-slate-500">Enter details without a card</div>
          </div>
        </div>
      </button>
    </div>
  )
}

// ============================================================
// SCAN VIEW
// ============================================================
function ScanView({ setView, user, refreshPending, online }) {
  const fileRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [file, setFile] = useState(null)
  const [processing, setProcessing] = useState(false)

  function pick() { fileRef.current?.click() }
  function onFile(e) {
    const f = e.target.files?.[0]; if (!f) return
    setFile(f)
    const r = new FileReader(); r.onload = () => setPreview(r.result); r.readAsDataURL(f)
  }
  function retake() { setFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = '' }

  async function process() {
    if (!file) { toast.error('Take or upload a card image first'); return }
    setProcessing(true)
    let cardImage = { url: '', key: '', dataUrl: preview }
    let ocr = null
    try {
      if (online) {
        // Upload first
        const fd = new FormData(); fd.append('image', file)
        const up = await api('/upload', { method: 'POST', body: fd })
        cardImage = { url: up.url, key: up.key, dataUrl: preview }
        // OCR
        const fd2 = new FormData(); fd2.append('image', file)
        try {
          ocr = await api('/ocr', { method: 'POST', body: fd2 })
        } catch (e) {
          toast.warning('OCR failed. Enter details manually.')
        }
      } else {
        toast.info('Offline — image will upload on sync. Enter details manually.')
      }
    } catch (e) {
      toast.error(`Upload failed: ${e.message}. Enter details manually.`)
    }
    const initial = ocr ? {
      full_name: ocr.full_name, company: ocr.company, job_title: ocr.job_title,
      email: ocr.email, mobile_phone: ocr.mobile_phone, office_phone: ocr.office_phone,
      website: ocr.website, address: ocr.address,
    } : {}
    setProcessing(false)
    setView({ name: 'manual', initial, cardImage, ocrRaw: ocr?.raw_text || '' })
  }

  return (
    <div className="space-y-4">
      <BackButton onClick={() => setView({ name: 'new' })} />
      <h2 className="text-xl font-bold">Scan Business Card</h2>
      <Card>
        <CardContent className="pt-6 space-y-4">
          {!preview && (
            <button onClick={pick} className="w-full aspect-[4/3] bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg grid place-items-center text-slate-500 hover:bg-slate-50">
              <div className="text-center">
                <Camera className="w-10 h-10 mx-auto mb-2" />
                <div className="font-semibold">Tap to Take or Upload</div>
                <div className="text-xs">JPG, PNG, or WebP</div>
              </div>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
          {preview && (
            <div className="space-y-3">
              <img src={preview} alt="Card preview" className="w-full rounded-lg border border-slate-200" />
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={retake}><RefreshCw className="w-4 h-4 mr-2" />Retake</Button>
                <Button onClick={process} disabled={processing} className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold">
                  {processing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</> : <><Upload className="w-4 h-4 mr-2" />Process</>}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// MANUAL / LEAD FORM (reused by Scan review + manual entry + edit)
// ============================================================
function ManualView({ setView, user, refreshPending, online, initial = {}, cardImage, ocrRaw }) {
  return (
    <div className="space-y-4">
      <BackButton onClick={() => setView({ name: 'new' })} />
      <h2 className="text-xl font-bold">{cardImage?.dataUrl ? 'Review & Save Lead' : 'Manual Lead Entry'}</h2>
      <LeadForm
        initial={initial}
        cardImage={cardImage}
        ocrRaw={ocrRaw}
        online={online}
        onSaved={() => {
          refreshPending()
          setView({ name: 'dashboard' })
        }}
        onSavedFallback={setView}
      />
      {cardImage?.dataUrl && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Card Image</CardTitle></CardHeader>
          <CardContent><img src={cardImage.dataUrl} alt="Card" className="w-full rounded-md border" /></CardContent>
        </Card>
      )}
    </div>
  )
}

function LeadForm({ initial = {}, cardImage, ocrRaw = '', online, onSaved, editingLead, onCancel, canEdit = true }) {
  const [form, setForm] = useState({
    full_name: '', company: '', job_title: '', email: '', mobile_phone: '', office_phone: '',
    website: '', address: '', city: '', state: '',
    customer_type: '', interests: [], project_name: '', project_location: '',
    approximate_square_footage: '', expected_project_start_date: '',
    timeline: 'Unknown', priority: 'Warm', status: 'Not Contacted',
    notes: '', follow_up_required: false, follow_up_date: '', follow_up_notes: '',
    ...(editingLead || initial),
  })
  const [saving, setSaving] = useState(false)
  const [dupOpen, setDupOpen] = useState(false)
  const [dupList, setDupList] = useState([])

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })) }
  function toggleInterest(v) {
    setForm((f) => ({ ...f, interests: f.interests.includes(v) ? f.interests.filter((x) => x !== v) : [...f.interests, v] }))
  }

  async function doSave(skipDupCheck = false) {
    if (!form.full_name && !form.email && !form.mobile_phone && !form.company) {
      toast.error('At least one of Name, Email, Phone, or Company is required'); return
    }
    // Duplicate check (only for new leads and when online)
    if (!editingLead && !skipDupCheck && online && (form.email || form.mobile_phone)) {
      try {
        const params = new URLSearchParams()
        if (form.email) params.set('email', form.email)
        if (form.mobile_phone) params.set('phone', form.mobile_phone)
        const { duplicates } = await api(`/leads/duplicates?${params.toString()}`)
        if (duplicates.length > 0) { setDupList(duplicates); setDupOpen(true); return }
      } catch (_e) { /* ignore duplicate check errors */ }
    }

    setSaving(true)
    const payload = {
      ...form,
      card_image_url: cardImage?.url || editingLead?.card_image_url || '',
      card_image_key: cardImage?.key || editingLead?.card_image_key || '',
      ocr_raw_text: ocrRaw || editingLead?.ocr_raw_text || '',
    }
    try {
      if (editingLead) {
        const { lead } = await api(`/leads/${editingLead.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        setSaving(false)
        toast.success('Saved')
        onSaved?.(lead, false)
      } else if (online) {
        const { lead } = await api('/leads', { method: 'POST', body: JSON.stringify(payload) })
        setSaving(false)
        toast.success('Lead saved')
        onSaved?.(lead, false)
      } else {
        // Offline: queue in IndexedDB
        const id = crypto.randomUUID()
        // Store base64 image dataUrl too, since we couldn't upload
        const offlineLead = { ...payload, id, created_at: new Date().toISOString(), _offline_card_dataurl: cardImage?.dataUrl || '' }
        await idbPut(offlineLead)
        setSaving(false)
        toast.success('Saved offline — will sync automatically')
        onSaved?.(offlineLead, true)
      }
    } catch (e) { setSaving(false); toast.error(e.message) }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Contact</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-3">
          <Field label="Full Name"><Input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} disabled={!canEdit} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Company"><Input value={form.company} onChange={(e) => set('company', e.target.value)} disabled={!canEdit} /></Field>
            <Field label="Job Title"><Input value={form.job_title} onChange={(e) => set('job_title', e.target.value)} disabled={!canEdit} /></Field>
          </div>
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} disabled={!canEdit} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mobile Phone"><Input type="tel" value={form.mobile_phone} onChange={(e) => set('mobile_phone', e.target.value)} disabled={!canEdit} /></Field>
            <Field label="Office Phone"><Input type="tel" value={form.office_phone} onChange={(e) => set('office_phone', e.target.value)} disabled={!canEdit} /></Field>
          </div>
          <Field label="Website"><Input value={form.website} onChange={(e) => set('website', e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Address"><Input value={form.address} onChange={(e) => set('address', e.target.value)} disabled={!canEdit} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City"><Input value={form.city} onChange={(e) => set('city', e.target.value)} disabled={!canEdit} /></Field>
            <Field label="State"><Input value={form.state} onChange={(e) => set('state', e.target.value)} disabled={!canEdit} /></Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Qualification</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="Customer Type">
            <Select value={form.customer_type} onValueChange={(v) => set('customer_type', v)} disabled={!canEdit}>
              <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
              <SelectContent>{CUSTOMER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Interests (multi-select)">
            <div className="grid grid-cols-1 gap-1.5 mt-1">
              {INTERESTS.map((i) => (
                <label key={i} className="flex items-center gap-2 text-sm p-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
                  <Checkbox checked={form.interests.includes(i)} onCheckedChange={() => toggleInterest(i)} disabled={!canEdit} />
                  <span>{i}</span>
                </label>
              ))}
            </div>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Project</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-3">
          <Field label="Project Name"><Input value={form.project_name} onChange={(e) => set('project_name', e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Project Location"><Input value={form.project_location} onChange={(e) => set('project_location', e.target.value)} disabled={!canEdit} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Approx. Sq. Ft."><Input type="number" value={form.approximate_square_footage} onChange={(e) => set('approximate_square_footage', e.target.value)} disabled={!canEdit} /></Field>
            <Field label="Expected Start"><Input type="date" value={form.expected_project_start_date} onChange={(e) => set('expected_project_start_date', e.target.value)} disabled={!canEdit} /></Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Timeline & Priority</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Timeline">
              <Select value={form.timeline} onValueChange={(v) => set('timeline', v)} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIMELINES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={form.priority} onValueChange={(v) => set('priority', v)} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Status">
            <Select value={form.status} onValueChange={(v) => set('status', v)} disabled={!canEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Follow-Up & Notes</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.follow_up_required} onCheckedChange={(v) => set('follow_up_required', !!v)} disabled={!canEdit} />
            Follow-up required
          </label>
          {form.follow_up_required && (
            <>
              <Field label="Follow-up Date"><Input type="date" value={form.follow_up_date} onChange={(e) => set('follow_up_date', e.target.value)} disabled={!canEdit} /></Field>
              <Field label="Follow-up Notes"><Textarea rows={2} value={form.follow_up_notes} onChange={(e) => set('follow_up_notes', e.target.value)} disabled={!canEdit} /></Field>
            </>
          )}
          <Field label="Notes"><Textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} disabled={!canEdit} /></Field>
        </CardContent>
      </Card>

      {canEdit && (
        <div className="grid grid-cols-2 gap-3">
          {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
          <Button onClick={() => doSave(false)} disabled={saving} className={`bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold ${onCancel ? '' : 'col-span-2'}`}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingLead ? 'Save Changes' : 'Save Lead')}
          </Button>
        </div>
      )}

      <Dialog open={dupOpen} onOpenChange={setDupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500" /> Possible Duplicate</DialogTitle>
            <DialogDescription>We found leads with matching email or phone.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-auto">
            {dupList.map((d) => (
              <div key={d.id} className="p-2 border rounded-md">
                <div className="font-semibold text-sm">{d.full_name} — {d.company}</div>
                <div className="text-xs text-slate-500">{d.email} · {d.mobile_phone}</div>
              </div>
            ))}
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-col">
            <Button variant="outline" onClick={() => { setDupOpen(false); doSave(true) }}>Save as Separate Lead</Button>
            <Button onClick={() => { setDupOpen(false); location.hash = ''; window.dispatchEvent(new CustomEvent('open_lead', { detail: dupList[0].id })) }}>
              Open Existing Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Field({ label, children }) {
  return (<div><Label className="text-xs uppercase tracking-wider text-slate-500">{label}</Label><div className="mt-1">{children}</div></div>)
}

// ============================================================
// LEADS LIST
// ============================================================
function LeadsList({ setView }) {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState('')
  const [status, setStatus] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [sort, setSort] = useState('newest')

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [search, priority, status, followUp, sort])

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ search, priority, status, follow_up: followUp, sort })
      const { leads } = await api(`/leads?${params.toString()}`)
      setLeads(leads)
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }

  useEffect(() => {
    function handler(e) { setView({ name: 'detail', id: e.detail }) }
    window.addEventListener('open_lead', handler)
    return () => window.removeEventListener('open_lead', handler)
  }, [setView])

  return (
    <div className="space-y-3">
      <BackButton onClick={() => setView({ name: 'dashboard' })} />
      <h2 className="text-xl font-bold">Leads</h2>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
        <Input placeholder="Search name, company, email, phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select value={priority || 'ALL'} onValueChange={(v) => setPriority(v === 'ALL' ? '' : v)}>
          <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Priorities</SelectItem>
            {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status || 'ALL'} onValueChange={(v) => setStatus(v === 'ALL' ? '' : v)}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {STATUSES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={followUp || 'ALL'} onValueChange={(v) => setFollowUp(v === 'ALL' ? '' : v)}>
          <SelectTrigger><SelectValue placeholder="Follow-up" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            <SelectItem value="yes">Follow-up Required</SelectItem>
            <SelectItem value="no">No Follow-up</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {loading && <div className="text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>}
      {!loading && leads.length === 0 && <div className="text-sm text-slate-500 py-8 text-center">No leads found.</div>}
      <div className="space-y-2">
        {leads.map((l) => (
          <div key={l.id} onClick={() => setView({ name: 'detail', id: l.id })} className="p-3 bg-white border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900 truncate">{l.full_name || l.email || 'Unnamed'}</div>
                <div className="text-xs text-slate-600 truncate">{l.company || '—'}{l.job_title ? ` · ${l.job_title}` : ''}</div>
                <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3">
                  {l.mobile_phone && <span>{l.mobile_phone}</span>}
                  {l.email && <span className="truncate">{l.email}</span>}
                </div>
                {l.interests?.length > 0 && (
                  <div className="text-xs text-slate-500 mt-1 truncate">{l.interests.slice(0, 2).join(' • ')}{l.interests.length > 2 ? ' …' : ''}</div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge className={PRIORITY_STYLES[l.priority] || ''} variant="outline">{l.priority}</Badge>
                <span className="text-[10px] text-slate-400">{new Date(l.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <Badge variant="secondary" className="text-[10px]">{l.status}</Badge>
              {l.follow_up_required && l.follow_up_date && <span className="text-[10px] text-amber-700">↻ {l.follow_up_date}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// LEAD DETAIL
// ============================================================
function LeadDetail({ id, setView, user }) {
  const [lead, setLead] = useState(null)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try { const { lead } = await api(`/leads/${id}`); setLead(lead) }
    catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [id])

  async function archive() {
    if (!confirm('Archive this lead?')) return
    try { await api(`/leads/${id}`, { method: 'DELETE' }); toast.success('Archived'); setView({ name: 'list' }) }
    catch (e) { toast.error(e.message) }
  }

  if (loading) return <div className="text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
  if (!lead) return <div>Lead not found</div>

  const canEdit = user.role === 'admin' || lead.captured_by === user.id

  if (editing) {
    return (
      <div className="space-y-4">
        <BackButton onClick={() => setEditing(false)} label="Cancel" />
        <h2 className="text-xl font-bold">Edit Lead</h2>
        <LeadForm editingLead={lead} online={true} canEdit={canEdit}
          onSaved={(l) => { setLead(l); setEditing(false) }}
          onCancel={() => setEditing(false)} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <BackButton onClick={() => setView({ name: 'list' })} />
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold">{lead.full_name || 'Unnamed'}</h2>
          <div className="text-sm text-slate-500">{lead.job_title}{lead.job_title && lead.company ? ' · ' : ''}{lead.company}</div>
        </div>
        <Badge className={PRIORITY_STYLES[lead.priority] || ''} variant="outline">{lead.priority}</Badge>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {lead.mobile_phone && <a href={`tel:${lead.mobile_phone}`} className="bg-white border rounded-md p-3 text-center hover:bg-slate-50"><Phone className="w-5 h-5 mx-auto text-slate-700" /><div className="text-xs mt-1">Call</div></a>}
        {lead.email && <a href={`mailto:${lead.email}`} className="bg-white border rounded-md p-3 text-center hover:bg-slate-50"><Mail className="w-5 h-5 mx-auto text-slate-700" /><div className="text-xs mt-1">Email</div></a>}
        {lead.website && <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" className="bg-white border rounded-md p-3 text-center hover:bg-slate-50"><Globe className="w-5 h-5 mx-auto text-slate-700" /><div className="text-xs mt-1">Website</div></a>}
      </div>

      {lead.card_image_url && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Business Card</CardTitle></CardHeader>
          <CardContent><img src={lead.card_image_url} alt="Card" className="w-full rounded-md border" /></CardContent>
        </Card>
      )}

      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Contact</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <Row label="Email">{lead.email ? <a className="text-blue-600 underline" href={`mailto:${lead.email}`}>{lead.email}</a> : '—'}</Row>
          <Row label="Mobile">{lead.mobile_phone ? <a className="text-blue-600 underline" href={`tel:${lead.mobile_phone}`}>{lead.mobile_phone}</a> : '—'}</Row>
          <Row label="Office">{lead.office_phone || '—'}</Row>
          <Row label="Website">{lead.website || '—'}</Row>
          <Row label="Address">{[lead.address, lead.city, lead.state].filter(Boolean).join(', ') || '—'}</Row>
        </CardContent>
      </Card>

      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Qualification</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <Row label="Type">{lead.customer_type || '—'}</Row>
          <Row label="Interests">{lead.interests?.join(', ') || '—'}</Row>
          <Row label="Timeline">{lead.timeline}</Row>
          <Row label="Status">{lead.status}</Row>
        </CardContent>
      </Card>

      {(lead.project_name || lead.project_location) && (
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Project</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <Row label="Name">{lead.project_name || '—'}</Row>
            <Row label="Location">{lead.project_location || '—'}</Row>
            <Row label="Sq. Ft.">{lead.approximate_square_footage || '—'}</Row>
            <Row label="Expected Start">{lead.expected_project_start_date || '—'}</Row>
          </CardContent>
        </Card>
      )}

      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Follow-Up & Notes</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <Row label="Follow-up">{lead.follow_up_required ? `Yes${lead.follow_up_date ? ` · ${lead.follow_up_date}` : ''}` : 'No'}</Row>
          {lead.follow_up_notes && <Row label="F/U Notes">{lead.follow_up_notes}</Row>}
          {lead.notes && <Row label="Notes">{lead.notes}</Row>}
        </CardContent>
      </Card>

      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Meta</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <Row label="Captured By">{lead.captured_by_name}</Row>
          <Row label="Captured At">{new Date(lead.created_at).toLocaleString()}</Row>
          <Row label="Event">{lead.event_id}</Row>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {canEdit && <Button onClick={() => setEditing(true)} className="bg-slate-900 hover:bg-slate-800">Edit</Button>}
        {user.role === 'admin' && <Button variant="outline" onClick={archive}><Archive className="w-4 h-4 mr-2" />Archive</Button>}
      </div>
    </div>
  )
}
function Row({ label, children }) { return (<div className="grid grid-cols-3 gap-2 py-1"><div className="text-slate-500 text-xs uppercase tracking-wider">{label}</div><div className="col-span-2 break-words">{children}</div></div>) }

// ============================================================
// EXPORT
// ============================================================
function ExportView({ user }) {
  const isAdmin = user.role === 'admin'
  async function download(scope) {
    try {
      const t = getToken()
      const res = await fetch(`/api/leads/export?scope=${scope}`, { headers: { Authorization: `Bearer ${t}` } })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `framex-leads-${scope}.csv`; a.click()
      URL.revokeObjectURL(url)
      toast.success('CSV downloaded')
    } catch (e) { toast.error(e.message) }
  }
  if (!isAdmin) return <div className="text-slate-500">Admin only.</div>
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold">Export Leads (CSV)</h2>
      <p className="text-sm text-slate-500">Download all fields including contact, qualification, follow-up, event, and notes.</p>
      <div className="grid gap-2">
        <Button onClick={() => download('all')} className="h-12">All Leads</Button>
        <Button onClick={() => download('event')} variant="outline" className="h-12">Active Event Leads</Button>
        <Button onClick={() => download('hot')} variant="outline" className="h-12">Hot Leads</Button>
        <Button onClick={() => download('follow_up')} variant="outline" className="h-12">Follow-Up Required</Button>
      </div>
    </div>
  )
}

// ============================================================
// SETTINGS
// ============================================================
function SettingsView({ user }) {
  const [event, setEvent] = useState(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => { (async () => { const { event } = await api('/events/active'); setEvent(event) })() }, [])
  async function save() {
    setSaving(true)
    try {
      const { event: e } = await api('/events/active', { method: 'PUT', body: JSON.stringify(event) })
      setEvent(e); toast.success('Event saved')
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }
  if (!event) return <div className="text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
  const canEdit = user.role === 'admin'
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Settings</h2>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Active Expo Event</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="Event Name"><Input value={event.name || ''} onChange={(e) => setEvent({ ...event, name: e.target.value })} disabled={!canEdit} /></Field>
          <Field label="Venue"><Input value={event.venue || ''} onChange={(e) => setEvent({ ...event, venue: e.target.value })} disabled={!canEdit} /></Field>
          <Field label="Event Date"><Input type="date" value={event.event_date || ''} onChange={(e) => setEvent({ ...event, event_date: e.target.value })} disabled={!canEdit} /></Field>
          <Field label="Booth Number"><Input value={event.booth_number || ''} onChange={(e) => setEvent({ ...event, booth_number: e.target.value })} disabled={!canEdit} /></Field>
          {canEdit && <Button onClick={save} disabled={saving} className="bg-slate-900 hover:bg-slate-800">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}</Button>}
        </CardContent>
      </Card>
      {canEdit && <EventsManager activeEventId={event.id} onActivated={setEvent} />}
      {canEdit && <StaffManager currentUserId={user.id} />}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">About</CardTitle></CardHeader>
        <CardContent className="text-sm text-slate-600 space-y-1">
          <div>User: {user.full_name} ({user.role})</div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// EVENTS MANAGER (admin)
// ============================================================
function EventsManager({ activeEventId, onActivated }) {
  const [events, setEvents] = useState(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', venue: '', event_date: '', booth_number: '' })

  async function load() { const { events } = await api('/events'); setEvents(events) }
  useEffect(() => { load() }, [])

  async function create() {
    if (!form.name.trim()) { toast.error('Event name required'); return }
    setCreating(true)
    try {
      await api('/events', { method: 'POST', body: JSON.stringify(form) })
      setForm({ name: '', venue: '', event_date: '', booth_number: '' })
      toast.success('Event created')
      await load()
    } catch (e) { toast.error(e.message) } finally { setCreating(false) }
  }

  async function activate(id) {
    try {
      const { event } = await api(`/events/${id}/activate`, { method: 'POST' })
      toast.success(`"${event.name}" is now active`)
      onActivated?.(event)
      await load()
    } catch (e) { toast.error(e.message) }
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">All Events</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {!events && <div className="text-sm text-slate-400">Loading…</div>}
        {events?.map((ev) => (
          <div key={ev.id} className="flex items-center justify-between border border-slate-200 rounded-lg p-3">
            <div>
              <div className="font-medium flex items-center gap-2">
                {ev.name}
                {ev.id === activeEventId && <Badge className="bg-green-500 hover:bg-green-500">Active</Badge>}
              </div>
              <div className="text-xs text-slate-500">{ev.venue}{ev.event_date ? ` · ${ev.event_date}` : ''}</div>
            </div>
            {ev.id !== activeEventId && (
              <Button size="sm" variant="outline" onClick={() => activate(ev.id)}>Set Active</Button>
            )}
          </div>
        ))}
        <Separator />
        <div className="space-y-2">
          <div className="text-sm font-medium">Create Event</div>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="Venue" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
            <Input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
            <Input placeholder="Booth Number" value={form.booth_number} onChange={(e) => setForm({ ...form, booth_number: e.target.value })} />
          </div>
          <Button onClick={create} disabled={creating} className="bg-slate-900 hover:bg-slate-800">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" />Create Event</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// STAFF MANAGER (admin)
// ============================================================
function StaffManager({ currentUserId }) {
  const [users, setUsers] = useState(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'staff' })

  async function load() { const { users } = await api('/users'); setUsers(users) }
  useEffect(() => { load() }, [])

  async function create() {
    if (!form.full_name.trim() || !form.email.trim() || form.password.length < 6) {
      toast.error('Name, email, and a password of at least 6 characters are required'); return
    }
    setCreating(true)
    try {
      await api('/users', { method: 'POST', body: JSON.stringify(form) })
      setForm({ full_name: '', email: '', password: '', role: 'staff' })
      toast.success('User created')
      await load()
    } catch (e) { toast.error(e.message) } finally { setCreating(false) }
  }

  async function remove(id) {
    if (!confirm('Remove this user? They will no longer be able to sign in.')) return
    try {
      await api(`/users/${id}`, { method: 'DELETE' })
      toast.success('User removed')
      await load()
    } catch (e) { toast.error(e.message) }
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Staff & Admin Accounts</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {!users && <div className="text-sm text-slate-400">Loading…</div>}
        {users?.map((u) => (
          <div key={u.id} className="flex items-center justify-between border border-slate-200 rounded-lg p-3">
            <div>
              <div className="font-medium flex items-center gap-2">
                {u.full_name}
                <Badge variant="outline">{u.role}</Badge>
                {u.id === currentUserId && <span className="text-xs text-slate-400">(you)</span>}
              </div>
              <div className="text-xs text-slate-500">{u.email}</div>
            </div>
            {u.id !== currentUserId && (
              <Button size="icon" variant="ghost" onClick={() => remove(u.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
            )}
          </div>
        ))}
        <Separator />
        <div className="space-y-2">
          <div className="text-sm font-medium">Add User</div>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Full Name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <Input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={create} disabled={creating} className="bg-slate-900 hover:bg-slate-800">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" />Add User</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// SYNC QUEUE
// ============================================================
function SyncQueueView({ refreshPending, online }) {
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  async function load() { setItems(await idbAll()) }
  useEffect(() => { load() }, [])
  async function retryAll() {
    setBusy(true)
    let failed = 0
    for (const it of items) {
      try { await api('/leads', { method: 'POST', body: JSON.stringify(it) }); await idbDelete(it.id) }
      catch { failed++ }
    }
    await load(); refreshPending(); setBusy(false)
    if (failed === 0) toast.success('All synced'); else toast.error(`${failed} lead(s) failed`)
  }
  async function del(id) { await idbDelete(id); await load(); refreshPending() }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold flex items-center gap-2"><CloudOff className="w-5 h-5" /> Sync Queue</h2>
      <div className="text-sm text-slate-500">
        {online ? 'You are online. Pending leads sync automatically.' : 'You are offline. Leads will sync when the connection returns.'}
      </div>
      {items.length === 0 && <div className="text-sm text-slate-500 py-8 text-center">No pending leads.</div>}
      {items.length > 0 && (
        <>
          <Button onClick={retryAll} disabled={busy || !online} className="w-full bg-slate-900 hover:bg-slate-800">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RefreshCw className="w-4 h-4 mr-2" />Retry Sync ({items.length})</>}
          </Button>
          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.id} className="p-3 bg-white border rounded-md flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm">{it.full_name || it.email || 'Unnamed'}</div>
                  <div className="text-xs text-slate-500">{it.company || '—'}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => del(it.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ============================================================
// SHARED
// ============================================================
function BackButton({ onClick, label = 'Back' }) {
  return <Button variant="ghost" size="sm" onClick={onClick} className="text-slate-600"><ArrowLeft className="w-4 h-4 mr-1" />{label}</Button>
}

// Handle open_lead events fired from Duplicate dialog / Saved screen
if (typeof window !== 'undefined') {
  window.addEventListener('open_lead', (e) => {
    // handled by LeadsList; also allow direct navigation via hash
    location.hash = `#lead=${e.detail}`
  })
}
