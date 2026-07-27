import { getDb } from './mongodb'
import { hashPassword } from './auth'
import { v4 as uuidv4 } from 'uuid'

export async function ensureSeed() {
  const db = await getDb()

  // Seed users if missing
  const userCount = await db.collection('profiles').countDocuments()
  if (userCount === 0) {
    const adminEmail = process.env.DEMO_ADMIN_EMAIL || 'admin@framex.com'
    const adminPassword = process.env.DEMO_ADMIN_PASSWORD || 'admin123'
    const staffEmail = process.env.DEMO_STAFF_EMAIL || 'staff@framex.com'
    const staffPassword = process.env.DEMO_STAFF_PASSWORD || 'staff123'

    await db.collection('profiles').insertMany([
      {
        id: uuidv4(),
        full_name: 'Demo Admin',
        email: adminEmail.toLowerCase(),
        password_hash: hashPassword(adminPassword),
        role: 'admin',
        created_at: new Date(),
      },
      {
        id: uuidv4(),
        full_name: 'Demo Staff',
        email: staffEmail.toLowerCase(),
        password_hash: hashPassword(staffPassword),
        role: 'staff',
        created_at: new Date(),
      },
    ])
  }

  // Seed active event
  const eventCount = await db.collection('events').countDocuments()
  let activeEvent
  if (eventCount === 0) {
    activeEvent = {
      id: uuidv4(),
      name: 'Houston Expo',
      venue: 'Houston, Texas',
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date().toISOString().slice(0, 10),
      booth_number: 'To Be Confirmed',
      active: true,
      created_at: new Date(),
      updated_at: new Date(),
    }
    await db.collection('events').insertOne(activeEvent)
  } else {
    activeEvent = await db.collection('events').findOne({ active: true }) ||
                  await db.collection('events').findOne({})
  }

  // Seed 5 demo leads
  const leadCount = await db.collection('leads').countDocuments()
  if (leadCount === 0 && activeEvent) {
    const staff = await db.collection('profiles').findOne({ role: 'staff' })
    const now = new Date()
    const demoLeads = [
      {
        full_name: 'Robert Martinez', company: 'Martinez Construction Co.', job_title: 'CEO',
        email: 'rmartinez@martinezconst.demo', mobile_phone: '+1 (713) 555-0201', office_phone: '',
        website: 'martinezconst.demo', address: '', city: 'Houston', state: 'TX',
        customer_type: 'General Contractor', interests: ['Light-Gauge Steel Framing', 'Prefabricated Wall Panels'],
        project_name: 'Downtown Mixed-Use Tower', project_location: 'Houston, TX',
        approximate_square_footage: 145000, expected_project_start_date: '2025-09-15',
        timeline: 'Within 3 Months', priority: 'Hot', status: 'Follow-Up Scheduled',
        notes: 'Very interested in prefab wall panels. Wants a site visit.',
        follow_up_required: true, follow_up_date: '2025-06-25', follow_up_notes: 'Send pricing packet',
      },
      {
        full_name: 'Sarah Kim', company: 'Kim Architects LLP', job_title: 'Senior Architect',
        email: 'sarah.kim@kimarch.demo', mobile_phone: '+1 (832) 555-0117', office_phone: '+1 (832) 555-0100',
        website: 'kimarch.demo', address: '', city: 'Houston', state: 'TX',
        customer_type: 'Architect', interests: ['Design and Engineering', 'Light-Gauge Steel Framing'],
        project_name: 'Woodlands Medical Campus', project_location: 'The Woodlands, TX',
        approximate_square_footage: 68000, expected_project_start_date: '2026-01-10',
        timeline: 'Within 6 Months', priority: 'Warm', status: 'Contacted',
        notes: 'Looking for engineering support on light-gauge steel design.',
        follow_up_required: true, follow_up_date: '2025-07-05', follow_up_notes: '',
      },
      {
        full_name: 'James O\'Brien', company: 'O\'Brien Framing Supply', job_title: 'Purchasing Manager',
        email: 'james@obrienframing.demo', mobile_phone: '+1 (281) 555-0142', office_phone: '',
        website: '', address: '', city: 'Katy', state: 'TX',
        customer_type: 'Dealer or Distributor', interests: ['Steel Studs and Tracks', 'Dealer or Distributor Opportunity'],
        project_name: '', project_location: '',
        approximate_square_footage: 0, expected_project_start_date: '',
        timeline: 'Immediate', priority: 'Hot', status: 'Qualified',
        notes: 'Wants to become a regional distributor.',
        follow_up_required: true, follow_up_date: '2025-06-20', follow_up_notes: 'Send distributor agreement',
      },
      {
        full_name: 'Emily Zhang', company: 'Zhang Development Group', job_title: 'Project Executive',
        email: 'ezhang@zhangdev.demo', mobile_phone: '+1 (713) 555-0166', office_phone: '',
        website: 'zhangdev.demo', address: '', city: 'Sugar Land', state: 'TX',
        customer_type: 'Developer', interests: ['Prefabricated Wall Panels', 'Installation'],
        project_name: 'Sugar Land Apartments Phase 2', project_location: 'Sugar Land, TX',
        approximate_square_footage: 210000, expected_project_start_date: '2025-11-01',
        timeline: 'Within 6 Months', priority: 'Warm', status: 'Not Contacted',
        notes: '',
        follow_up_required: false, follow_up_date: '', follow_up_notes: '',
      },
      {
        full_name: 'Carlos Rivera', company: 'Rivera Homes', job_title: 'Owner',
        email: 'carlos@riverahomes.demo', mobile_phone: '+1 (832) 555-0199', office_phone: '',
        website: '', address: '', city: 'Houston', state: 'TX',
        customer_type: 'Builder', interests: ['General Information', 'Light-Gauge Steel Framing'],
        project_name: '', project_location: '',
        approximate_square_footage: 0, expected_project_start_date: '',
        timeline: 'Within 12 Months', priority: 'Cold', status: 'Not Contacted',
        notes: 'Curious about steel framing for custom homes.',
        follow_up_required: false, follow_up_date: '', follow_up_notes: '',
      },
    ]

    const docs = demoLeads.map((l, i) => ({
      id: uuidv4(),
      ...l,
      card_image_url: '',
      card_image_key: '',
      ocr_raw_text: '',
      event_id: activeEvent.id,
      captured_by: staff?.id || 'seed',
      captured_by_name: staff?.full_name || 'Demo Staff',
      sync_status: 'synced',
      archived_at: null,
      created_at: new Date(now.getTime() - i * 3600 * 1000),
      updated_at: new Date(now.getTime() - i * 3600 * 1000),
    }))
    await db.collection('leads').insertMany(docs)
  }

  // Ensure indexes
  await db.collection('profiles').createIndex({ email: 1 }, { unique: true })
  await db.collection('leads').createIndex({ created_at: -1 })
  await db.collection('leads').createIndex({ email: 1 })
  await db.collection('leads').createIndex({ mobile_phone: 1 })
  await db.collection('leads').createIndex({ priority: 1 })
  await db.collection('leads').createIndex({ status: 1 })
}
