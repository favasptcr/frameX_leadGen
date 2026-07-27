import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/mongodb'
import { hashPassword, verifyPassword, signToken, getUserFromRequest } from '@/lib/auth'
import { runOcr } from '@/lib/ocr'
import { saveFile } from '@/lib/storage'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

let seeded = false
async function ensureInit() {
  if (!seeded) {
    try { await ensureSeed() } catch (e) { console.error('Seed error', e) }
    seeded = true
  }
}

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return res
}
function json(data, init) { return cors(NextResponse.json(data, init)) }
function err(msg, status = 400) { return json({ error: msg }, { status }) }

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

function stripId(doc) { if (!doc) return doc; const { _id, password_hash, ...rest } = doc; return rest }

async function requireAuth(request) {
  const u = getUserFromRequest(request)
  if (!u) return { error: err('Unauthorized', 401) }
  const db = await getDb()
  const user = await db.collection('profiles').findOne({ id: u.sub })
  if (!user) return { error: err('Unauthorized', 401) }
  return { user }
}

function requireAdmin(user) {
  if (user.role !== 'admin') return err('Admin only', 403)
  return null
}

function csvEscape(v) {
  if (v === null || v === undefined) return ''
  const s = String(v).replace(/"/g, '""')
  return /[",\n]/.test(s) ? `"${s}"` : s
}

function leadsToCsv(leads) {
  const cols = [
    'id', 'full_name', 'company', 'job_title', 'email', 'mobile_phone', 'office_phone',
    'website', 'address', 'city', 'state', 'customer_type', 'interests', 'project_name',
    'project_location', 'approximate_square_footage', 'expected_project_start_date',
    'timeline', 'priority', 'status', 'notes', 'follow_up_required', 'follow_up_date',
    'follow_up_notes', 'card_image_url', 'event_id', 'captured_by_name',
    'created_at', 'updated_at',
  ]
  const header = cols.join(',')
  const rows = leads.map((l) =>
    cols.map((c) => {
      let v = l[c]
      if (Array.isArray(v)) v = v.join('; ')
      if (v instanceof Date) v = v.toISOString()
      return csvEscape(v)
    }).join(',')
  )
  return [header, ...rows].join('\n')
}

async function handleRoute(request, { params }) {
  await ensureInit()
  const p = (await params).path || []
  const route = '/' + p.join('/')
  const method = request.method
  const db = await getDb()

  try {
    // ---------- Health ----------
    if (route === '/' || route === '/root') return json({ ok: true, app: 'FrameX LeadFlow' })

    // ---------- AUTH ----------
    if (route === '/auth/login' && method === 'POST') {
      const { email, password } = await request.json()
      if (!email || !password) return err('Email and password required')
      const user = await db.collection('profiles').findOne({ email: String(email).toLowerCase() })
      if (!user || !verifyPassword(password, user.password_hash)) return err('Invalid credentials', 401)
      const token = signToken({ sub: user.id, role: user.role, email: user.email })
      return json({ token, user: stripId(user) })
    }

    if (route === '/auth/me' && method === 'GET') {
      const { user, error } = await requireAuth(request); if (error) return error
      return json({ user: stripId(user) })
    }

    // ---------- OCR (mock) ----------
    if (route === '/ocr' && method === 'POST') {
      const { user, error } = await requireAuth(request); if (error) return error
      // Accept either multipart file OR JSON with imageUrl (already uploaded). MVP: read multipart.
      const ct = request.headers.get('content-type') || ''
      let buf = null, mime = 'image/jpeg'
      if (ct.includes('multipart/form-data')) {
        const fd = await request.formData()
        const f = fd.get('image')
        if (f && typeof f !== 'string') {
          buf = Buffer.from(await f.arrayBuffer())
          mime = f.type || 'image/jpeg'
        }
      }
      try {
        const result = await runOcr(buf, mime)
        return json({ ok: true, ...result })
      } catch (e) {
        return json({ ok: false, error: e.message }, { status: 500 })
      }
    }

    // ---------- Upload ----------
    if (route === '/upload' && method === 'POST') {
      const { user, error } = await requireAuth(request); if (error) return error
      const fd = await request.formData()
      const f = fd.get('image')
      if (!f || typeof f === 'string') return err('image field required')
      const buf = Buffer.from(await f.arrayBuffer())
      const saved = await saveFile(buf, f.type || 'image/jpeg')
      return json({ ok: true, ...saved, uploadedAt: new Date().toISOString() })
    }

    // ---------- Events ----------
    if (route === '/events/active' && method === 'GET') {
      const { user, error } = await requireAuth(request); if (error) return error
      const ev = await db.collection('events').findOne({ active: true }) || await db.collection('events').findOne({})
      return json({ event: stripId(ev) })
    }

    if (route === '/events/active' && method === 'PUT') {
      const { user, error } = await requireAuth(request); if (error) return error
      const adminErr = requireAdmin(user); if (adminErr) return adminErr
      const body = await request.json()
      const active = await db.collection('events').findOne({ active: true }) || await db.collection('events').findOne({})
      if (!active) {
        const doc = {
          id: uuidv4(),
          name: body.name || 'Houston Expo',
          venue: body.venue || 'Houston, Texas',
          event_date: body.event_date || new Date().toISOString().slice(0, 10),
          booth_number: body.booth_number || 'To Be Confirmed',
          active: true,
          created_at: new Date(), updated_at: new Date(),
        }
        await db.collection('events').insertOne(doc)
        return json({ event: stripId(doc) })
      }
      const upd = {
        name: body.name ?? active.name,
        venue: body.venue ?? active.venue,
        event_date: body.event_date ?? active.event_date,
        booth_number: body.booth_number ?? active.booth_number,
        updated_at: new Date(),
      }
      await db.collection('events').updateOne({ id: active.id }, { $set: upd })
      const out = await db.collection('events').findOne({ id: active.id })
      return json({ event: stripId(out) })
    }

    if (route === '/events' && method === 'GET') {
      const { user, error } = await requireAuth(request); if (error) return error
      const adminErr = requireAdmin(user); if (adminErr) return adminErr
      const events = await db.collection('events').find({}).sort({ created_at: -1 }).toArray()
      return json({ events: events.map(stripId) })
    }

    if (route === '/events' && method === 'POST') {
      const { user, error } = await requireAuth(request); if (error) return error
      const adminErr = requireAdmin(user); if (adminErr) return adminErr
      const body = await request.json()
      if (!body.name) return err('Event name required')
      const hasActive = await db.collection('events').findOne({ active: true })
      const doc = {
        id: uuidv4(),
        name: body.name,
        venue: body.venue || '',
        event_date: body.event_date || new Date().toISOString().slice(0, 10),
        booth_number: body.booth_number || '',
        active: !hasActive,
        created_at: new Date(), updated_at: new Date(),
      }
      await db.collection('events').insertOne(doc)
      return json({ event: stripId(doc) })
    }

    const eventActivateMatch = route.match(/^\/events\/([^/]+)\/activate$/)
    if (eventActivateMatch && method === 'POST') {
      const { user, error } = await requireAuth(request); if (error) return error
      const adminErr = requireAdmin(user); if (adminErr) return adminErr
      const id = eventActivateMatch[1]
      const target = await db.collection('events').findOne({ id })
      if (!target) return err('Event not found', 404)
      await db.collection('events').updateMany({}, { $set: { active: false } })
      await db.collection('events').updateOne({ id }, { $set: { active: true, updated_at: new Date() } })
      const out = await db.collection('events').findOne({ id })
      return json({ event: stripId(out) })
    }

    // ---------- Users (admin) ----------
    if (route === '/users' && method === 'GET') {
      const { user, error } = await requireAuth(request); if (error) return error
      const adminErr = requireAdmin(user); if (adminErr) return adminErr
      const users = await db.collection('profiles').find({}).sort({ created_at: -1 }).toArray()
      return json({ users: users.map(stripId) })
    }

    if (route === '/users' && method === 'POST') {
      const { user, error } = await requireAuth(request); if (error) return error
      const adminErr = requireAdmin(user); if (adminErr) return adminErr
      const body = await request.json()
      const email = String(body.email || '').trim().toLowerCase()
      const fullName = String(body.full_name || '').trim()
      const password = String(body.password || '')
      const role = body.role === 'admin' ? 'admin' : 'staff'
      if (!email || !fullName) return err('Full name and email required')
      if (password.length < 6) return err('Password must be at least 6 characters')
      const existing = await db.collection('profiles').findOne({ email })
      if (existing) return err('A user with this email already exists', 409)
      const doc = {
        id: uuidv4(),
        full_name: fullName,
        email,
        password_hash: hashPassword(password),
        role,
        created_at: new Date(),
      }
      await db.collection('profiles').insertOne(doc)
      return json({ user: stripId(doc) })
    }

    const userMatch = route.match(/^\/users\/([^/]+)$/)
    if (userMatch && method === 'DELETE') {
      const { user, error } = await requireAuth(request); if (error) return error
      const adminErr = requireAdmin(user); if (adminErr) return adminErr
      const id = userMatch[1]
      if (id === user.id) return err('You cannot remove your own account')
      const target = await db.collection('profiles').findOne({ id })
      if (!target) return err('User not found', 404)
      if (target.role === 'admin') {
        const adminCount = await db.collection('profiles').countDocuments({ role: 'admin' })
        if (adminCount <= 1) return err('Cannot remove the last remaining admin')
      }
      await db.collection('profiles').deleteOne({ id })
      return json({ ok: true })
    }

    // ---------- Duplicate check ----------
    if (route === '/leads/duplicates' && method === 'GET') {
      const { user, error } = await requireAuth(request); if (error) return error
      const url = new URL(request.url)
      const email = (url.searchParams.get('email') || '').trim().toLowerCase()
      const phone = (url.searchParams.get('phone') || '').replace(/\D/g, '')
      const excludeId = url.searchParams.get('exclude') || ''
      const or = []
      if (email) or.push({ email: email })
      if (phone && phone.length >= 7) {
        // Search by suffix match on digits (last 10)
        const suffix = phone.slice(-10)
        or.push({ mobile_phone: { $regex: suffix.split('').join('.?') } })
      }
      if (or.length === 0) return json({ duplicates: [] })
      const q = { $or: or, archived_at: null }
      if (excludeId) q.id = { $ne: excludeId }
      const dups = await db.collection('leads').find(q).limit(5).toArray()
      return json({ duplicates: dups.map(stripId) })
    }

    // ---------- CSV Export ----------
    if (route === '/leads/export' && method === 'GET') {
      const { user, error } = await requireAuth(request); if (error) return error
      const adminErr = requireAdmin(user); if (adminErr) return adminErr
      const url = new URL(request.url)
      const scope = url.searchParams.get('scope') || 'all'
      const q = { archived_at: null }
      if (scope === 'event') {
        const ev = await db.collection('events').findOne({ active: true })
        if (ev) q.event_id = ev.id
      } else if (scope === 'hot') {
        q.priority = 'Hot'
      } else if (scope === 'follow_up') {
        q.follow_up_required = true
      } else if (scope === 'filtered') {
        // parse extra filters
        const search = url.searchParams.get('search') || ''
        const priority = url.searchParams.get('priority') || ''
        const status = url.searchParams.get('status') || ''
        const followUp = url.searchParams.get('follow_up') || ''
        if (priority) q.priority = priority
        if (status) q.status = status
        if (followUp === 'yes') q.follow_up_required = true
        if (search) {
          q.$or = [
            { full_name: { $regex: search, $options: 'i' } },
            { company: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { mobile_phone: { $regex: search } },
          ]
        }
      }
      const leads = await db.collection('leads').find(q).sort({ created_at: -1 }).toArray()
      const csv = leadsToCsv(leads.map(stripId))
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename=\"framex-leads-${scope}-${Date.now()}.csv\"`,
          'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
        },
      })
    }

    // ---------- Leads ----------
    if (route === '/leads' && method === 'GET') {
      const { user, error } = await requireAuth(request); if (error) return error
      const url = new URL(request.url)
      const search = url.searchParams.get('search') || ''
      const priority = url.searchParams.get('priority') || ''
      const status = url.searchParams.get('status') || ''
      const followUp = url.searchParams.get('follow_up') || ''
      const sort = url.searchParams.get('sort') || 'newest'
      const showArchived = url.searchParams.get('archived') === '1'
      const q = showArchived ? { archived_at: { $ne: null } } : { archived_at: null }
      if (priority) q.priority = priority
      if (status) q.status = status
      if (followUp === 'yes') q.follow_up_required = true
      if (followUp === 'no') q.follow_up_required = { $ne: true }
      if (search) {
        q.$or = [
          { full_name: { $regex: search, $options: 'i' } },
          { company: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { mobile_phone: { $regex: search } },
        ]
      }
      const cursor = db.collection('leads').find(q).sort({ created_at: sort === 'oldest' ? 1 : -1 }).limit(500)
      const list = (await cursor.toArray()).map(stripId)
      return json({ leads: list })
    }

    if (route === '/leads' && method === 'POST') {
      const { user, error } = await requireAuth(request); if (error) return error
      const body = await request.json()
      // Require at least one of: name, email, phone, company
      const has = (body.full_name || body.email || body.mobile_phone || body.company)
      if (!has) return err('At least one of name, email, phone, or company is required')

      const activeEvent = await db.collection('events').findOne({ active: true })
      const now = new Date()
      const doc = {
        id: body.id || uuidv4(),
        full_name: body.full_name || '',
        company: body.company || '',
        job_title: body.job_title || '',
        email: (body.email || '').toLowerCase(),
        mobile_phone: body.mobile_phone || '',
        office_phone: body.office_phone || '',
        website: body.website || '',
        address: body.address || '',
        city: body.city || '',
        state: body.state || '',
        customer_type: body.customer_type || '',
        interests: Array.isArray(body.interests) ? body.interests : [],
        project_name: body.project_name || '',
        project_location: body.project_location || '',
        approximate_square_footage: body.approximate_square_footage ? Number(body.approximate_square_footage) : 0,
        expected_project_start_date: body.expected_project_start_date || '',
        timeline: body.timeline || 'Unknown',
        priority: body.priority || 'Warm',
        status: body.status || 'Not Contacted',
        notes: body.notes || '',
        follow_up_required: !!body.follow_up_required,
        follow_up_date: body.follow_up_date || '',
        follow_up_notes: body.follow_up_notes || '',
        card_image_url: body.card_image_url || '',
        card_image_key: body.card_image_key || '',
        ocr_raw_text: body.ocr_raw_text || '',
        event_id: body.event_id || activeEvent?.id || '',
        captured_by: user.id,
        captured_by_name: user.full_name,
        sync_status: 'synced',
        archived_at: null,
        created_at: body.created_at ? new Date(body.created_at) : now,
        updated_at: now,
      }
      // Idempotency: if id provided and already exists, skip
      const existing = await db.collection('leads').findOne({ id: doc.id })
      if (existing) return json({ lead: stripId(existing), duplicate_id: true })
      await db.collection('leads').insertOne(doc)
      return json({ lead: stripId(doc) })
    }

    // Lead by id
    const leadMatch = route.match(/^\/leads\/([^/]+)$/)
    if (leadMatch) {
      const id = leadMatch[1]
      const { user, error } = await requireAuth(request); if (error) return error
      if (method === 'GET') {
        const lead = await db.collection('leads').findOne({ id })
        if (!lead) return err('Not found', 404)
        return json({ lead: stripId(lead) })
      }
      if (method === 'PUT') {
        const body = await request.json()
        const existing = await db.collection('leads').findOne({ id })
        if (!existing) return err('Not found', 404)
        // Staff can only edit leads they created
        if (user.role !== 'admin' && existing.captured_by !== user.id) return err('Forbidden', 403)
        const allowed = [
          'full_name', 'company', 'job_title', 'email', 'mobile_phone', 'office_phone', 'website',
          'address', 'city', 'state', 'customer_type', 'interests', 'project_name', 'project_location',
          'approximate_square_footage', 'expected_project_start_date', 'timeline', 'priority', 'status',
          'notes', 'follow_up_required', 'follow_up_date', 'follow_up_notes',
          'card_image_url', 'card_image_key',
        ]
        const upd = { updated_at: new Date() }
        for (const k of allowed) if (k in body) upd[k] = body[k]
        if (upd.email) upd.email = String(upd.email).toLowerCase()
        if (upd.approximate_square_footage !== undefined) upd.approximate_square_footage = Number(upd.approximate_square_footage) || 0
        await db.collection('leads').updateOne({ id }, { $set: upd })
        const out = await db.collection('leads').findOne({ id })
        return json({ lead: stripId(out) })
      }
      if (method === 'DELETE') {
        // Admin: archive
        if (user.role !== 'admin') return err('Admin only', 403)
        await db.collection('leads').updateOne({ id }, { $set: { archived_at: new Date(), updated_at: new Date() } })
        return json({ ok: true })
      }
    }

    // ---------- Dashboard stats ----------
    if (route === '/stats' && method === 'GET') {
      const { user, error } = await requireAuth(request); if (error) return error
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
      const total = await db.collection('leads').countDocuments({ archived_at: null })
      const today = await db.collection('leads').countDocuments({ archived_at: null, created_at: { $gte: startOfDay } })
      const hot = await db.collection('leads').countDocuments({ archived_at: null, priority: 'Hot' })
      const todayStr = new Date().toISOString().slice(0, 10)
      const followUps = await db.collection('leads').countDocuments({
        archived_at: null, follow_up_required: true, follow_up_date: { $lte: todayStr, $ne: '' },
      })
      const recent = await db.collection('leads').find({ archived_at: null }).sort({ created_at: -1 }).limit(5).toArray()
      return json({ total, today, hot, followUps, recent: recent.map(stripId) })
    }

    return err(`Route ${route} not found`, 404)
  } catch (e) {
    console.error('API Error', e)
    return err(e.message || 'Internal server error', 500)
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
