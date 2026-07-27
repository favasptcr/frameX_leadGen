// ==================================================================
// OCR SERVICE INTERFACE  --  MOCK IMPLEMENTATION
// ==================================================================
// To connect a real OCR provider later (Google Vision, AWS Textract,
// Mindee, etc.), replace the `runOcr` function below with the real
// SDK call and return the same shape:
//   {
//     full_name, company, job_title, email, mobile_phone,
//     office_phone, website, address, raw_text
//   }
// The rest of the application does NOT need to change.
// ==================================================================

const SAMPLE_CARDS = [
  {
    full_name: 'Michael Rodriguez',
    company: 'Rodriguez Steel Framing LLC',
    job_title: 'Owner / General Contractor',
    email: 'michael@rodriguezsteel.com',
    mobile_phone: '+1 (713) 555-0142',
    office_phone: '+1 (713) 555-0100',
    website: 'www.rodriguezsteel.com',
    address: '4521 Westheimer Rd, Houston, TX 77027',
  },
  {
    full_name: 'Jennifer Chen',
    company: 'Skyline Developments',
    job_title: 'Director of Construction',
    email: 'jchen@skylinedev.co',
    mobile_phone: '+1 (832) 555-0188',
    office_phone: '+1 (832) 555-0110',
    website: 'skylinedev.co',
    address: '1200 Main St, Suite 800, Houston, TX 77002',
  },
  {
    full_name: 'David Thompson',
    company: 'Thompson Architecture Group',
    job_title: 'Principal Architect',
    email: 'dthompson@thompsonarch.com',
    mobile_phone: '+1 (281) 555-0173',
    office_phone: '+1 (281) 555-0150',
    website: 'www.thompsonarch.com',
    address: '890 Kirby Dr, Houston, TX 77098',
  },
]

const BUSINESS_CARD_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export async function runOcr(_imageBuffer, _mimeType) {
  const provider = process.env.OCR_PROVIDER || 'mock'

  if (provider === 'mock') {
    // Simulate processing latency
    await new Promise((r) => setTimeout(r, 800))
    const sample = SAMPLE_CARDS[Math.floor(Math.random() * SAMPLE_CARDS.length)]
    return {
      ...sample,
      raw_text: `${sample.full_name}\n${sample.job_title}\n${sample.company}\n${sample.email}\n${sample.mobile_phone}\n${sample.website}\n${sample.address}`,
      provider: 'mock',
    }
  }

  if (provider === 'anthropic') {
    if (!_imageBuffer) throw new Error('image required for OCR')

    const [{ default: Anthropic }, { zodOutputFormat }, { z }] = await Promise.all([
      import('@anthropic-ai/sdk'),
      import('@anthropic-ai/sdk/helpers/zod'),
      import('zod/v4'),
    ])

    const mediaType = BUSINESS_CARD_MIME_TYPES.has(_mimeType) ? _mimeType : 'image/jpeg'

    const BusinessCard = z.object({
      full_name: z.string(),
      company: z.string(),
      job_title: z.string(),
      email: z.string(),
      mobile_phone: z.string(),
      office_phone: z.string(),
      website: z.string(),
      address: z.string(),
      raw_text: z.string(),
    })

    const client = new Anthropic()
    const response = await client.messages.parse({
      model: 'claude-opus-5',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: _imageBuffer.toString('base64') },
          },
          {
            type: 'text',
            text: 'Extract the contact details from this business card image. Use an empty string for any field not present on the card. raw_text should contain every line of visible text on the card, in reading order, separated by newlines.',
          },
        ],
      }],
      output_config: { format: zodOutputFormat(BusinessCard) },
    })

    if (!response.parsed_output) throw new Error('Could not read business card')
    return { ...response.parsed_output, provider: 'anthropic' }
  }

  // ===== PLUG A REAL OCR PROVIDER HERE =====
  // Example (Google Vision):
  //   const vision = new ImageAnnotatorClient({ credentials: ... })
  //   const [result] = await vision.textDetection({ image: { content: _imageBuffer } })
  //   const text = result.fullTextAnnotation?.text || ''
  //   return parseBusinessCardText(text)
  //
  // Example (Mindee):
  //   const client = new Mindee.Client({ apiKey: process.env.MINDEE_API_KEY })
  //   const resp = await client.parse(Mindee.product.BusinessCardV1, ...)
  //   return mapMindeeResponse(resp)
  // =========================================

  throw new Error(`OCR provider "${provider}" not implemented. See /app/lib/ocr.js`)
}
