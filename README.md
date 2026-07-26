# FrameX LeadFlow (MVP)

Simple, mobile-first PWA for capturing leads at the FrameX LGS Houston Expo. Built with **Next.js 15 + MongoDB + Tailwind + shadcn/ui**.

## Features (MVP scope only)
- Email/password login (JWT), Admin & Staff roles
- Dashboard with active-event card + core KPIs
- Business-card scan flow (camera or upload) → **mock OCR** → editable review
- Manual lead entry with FrameX qualification fields (customer type, interests, timeline, priority, status, follow-up)
- Leads list with search, filters (priority, status, follow-up), and sort
- Lead detail with click-to-call / email / open-website and archive
- Duplicate detection by email/phone before saving
- CSV export (all / active event / hot / follow-up)
- Basic settings (active expo event, editable by admin)
- **PWA**: manifest, service worker, installable, offline shell
- **Offline lead capture** via IndexedDB queue + auto-sync when online
- 5 seeded demo leads + demo admin/staff users

## Local setup
```bash
yarn install
cp .env.example .env
# MongoDB must be running (default: mongodb://localhost:27017)
yarn dev
```
- App: <http://localhost:3000>
- Demo login: `admin@framex.com` / `admin123` (admin) or `staff@framex.com` / `staff123` (staff)
- Data (users, active event, 5 demo leads) is seeded on first boot.

## Environment variables
See `.env.example`. Notable:
- `MONGO_URL`, `DB_NAME` – MongoDB connection
- `JWT_SECRET` – **must** be changed before production
- `DEMO_ADMIN_*`, `DEMO_STAFF_*` – override seeded demo credentials
- `OCR_PROVIDER` – `mock` (default) or your real provider key
- `STORAGE_PROVIDER` – `local` (default) or `s3`

## Where to plug in a real OCR provider
Open [`lib/ocr.js`](./lib/ocr.js). The `runOcr(imageBuffer, mimeType)` function is the only integration point. Replace the code inside the marked block:
```js
// ===== PLUG A REAL OCR PROVIDER HERE =====
// Google Vision, AWS Textract, or Mindee example is included in comments.
```
The rest of the app expects the same return shape: `{ full_name, company, job_title, email, mobile_phone, office_phone, website, address, raw_text }`. No other files need to change.

## Where to plug in real object storage
Open [`lib/storage.js`](./lib/storage.js). Implement the `s3` branch (or your provider) inside `saveFile()`. MongoDB only stores the returned `{ url, key, mimeType, size }` — swapping storage does not require schema changes.

## Supabase setup instructions (deferred to future migration)
This MVP intentionally uses **MongoDB + custom JWT** rather than Supabase (per project instructions). The database layer is isolated in `lib/mongodb.js` and the auth layer in `lib/auth.js`, so a future Supabase migration only needs to swap these two files plus the API route handlers that touch collections. Suggested migration:
1. Create a Supabase project → copy `SUPABASE_URL` + anon/service keys.
2. Recreate tables (`profiles`, `events`, `leads`) using the schema documented in this README (see below).
3. Enable Row Level Security with policies: staff can `SELECT` all leads and `UPDATE` only leads where `captured_by = auth.uid()`; admin can do anything.
4. Swap `lib/mongodb.js` for a Supabase client and `lib/auth.js` for Supabase Auth calls.

## Vercel deployment
1. Push this repo to GitHub.
2. On Vercel, import the project.
3. Add all env vars from `.env.example` in Vercel's Project → Settings → Environment Variables. Set a strong `JWT_SECRET`.
4. Point `MONGO_URL` to a hosted MongoDB (Atlas free tier works).
5. For production, set `STORAGE_PROVIDER=s3` and provide the S3 credentials — Vercel's read-only filesystem cannot use the default `local` storage in production.
6. Deploy. The service worker (`/public/sw.js`) and manifest (`/public/manifest.json`) are served automatically.

## Database schema (MongoDB collections)
### `profiles`
`id (uuid) · full_name · email (unique) · password_hash (scrypt) · role (admin|staff) · created_at`
### `events`
`id · name · venue · event_date · booth_number · active · created_at · updated_at`
### `leads`
`id · full_name · company · job_title · email · mobile_phone · office_phone · website · address · city · state · customer_type · interests[] · project_name · project_location · approximate_square_footage · expected_project_start_date · timeline · priority · status · notes · follow_up_required · follow_up_date · follow_up_notes · card_image_url · card_image_key · ocr_raw_text · event_id · captured_by · captured_by_name · sync_status · created_at · updated_at · archived_at`

Indexes are created automatically on first boot (`profiles.email` unique, `leads.created_at`, `leads.email`, `leads.mobile_phone`, `leads.priority`, `leads.status`).

## Assumptions & MVP notes
- **Passwords** are hashed with Node's built-in scrypt (no external deps). Demo credentials are shown on the login screen **only** in `NODE_ENV !== 'production'`.
- **OCR is a MOCK**. It returns one of three sample cards after ~800 ms. The mock endpoint lives at `POST /api/ocr` and is fully replaceable.
- **Business-card images** are saved to `/public/uploads/` in dev. On Vercel (read-only FS) you must switch to S3 before deploying.
- **Offline capture** stores leads in IndexedDB. When the browser comes back online, they are POSTed to `/api/leads` and removed from the queue. The card image is base64-cached in IDB until sync.
- **Duplicate detection** is a simple exact email + digit-suffix phone match (no fuzzy matching, per spec).
- No advanced analytics, charts, AI scoring, CRM/email/SMS integrations, or user-management UI, per spec.

## Final acceptance flow
1. Log in as staff → 2. tap **Scan New Lead** → 3. photograph a card → 4. review the mock-OCR fields → 5. select customer type, interest, timeline, priority → 6. add notes + follow-up → 7. tap **Save Lead** → 8. see the success screen with **Scan Next Card** → 9. find the lead in **Leads** → 10. edit or archive it → 11. as admin, export CSV → 12. toggle airplane mode, add a lead offline, reconnect and watch it sync.
