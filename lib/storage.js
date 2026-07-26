// ==================================================================
// STORAGE SERVICE INTERFACE  --  LOCAL FILESYSTEM IMPLEMENTATION
// ==================================================================
// To switch to S3 / Supabase Storage / GCS later, replace `saveFile`
// with the real SDK call and return { url, key, mimeType, size }.
// MongoDB only stores { url, key, mimeType, size, uploadedAt }.
// ==================================================================
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

export async function saveFile(buffer, mimeType) {
  const provider = process.env.STORAGE_PROVIDER || 'local'

  if (provider === 'local') {
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
    const ext =
      mimeType === 'image/png' ? 'png' :
      mimeType === 'image/webp' ? 'webp' :
      mimeType === 'image/gif' ? 'gif' : 'jpg'
    const filename = `${Date.now()}-${crypto.randomUUID()}.${ext}`
    const filepath = path.join(UPLOAD_DIR, filename)
    await fs.writeFile(filepath, buffer)
    return {
      url: `/uploads/${filename}`,
      key: filename,
      mimeType,
      size: buffer.length,
    }
  }

  // ===== PLUG S3 / OTHER STORAGE HERE =====
  throw new Error(`Storage provider "${provider}" not implemented. See /app/lib/storage.js`)
}
