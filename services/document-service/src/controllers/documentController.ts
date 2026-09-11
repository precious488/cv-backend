import { Response } from 'express'
import puppeteer, { Browser } from 'puppeteer'
import { z } from 'zod'
import { renderTemplate, ResumeData } from '../templates/htmlTemplates'
import { AuthenticatedRequest } from '@craft/shared'
import { logger } from '@craft/shared'
import { v4 as uuidv4 } from 'uuid'
import { containsSuspiciousMarkup } from '../utils/detectMaliciousInput'
import { publishEvent } from '@craft/shared'

let browserInstance: Browser | null = null

// async function getBrowser(): Promise<Browser> {
//   if (!browserInstance || !browserInstance.connected) {
//     browserInstance = await puppeteer.launch({
//       headless: true,
//       executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
//       args: [
//         '--no-sandbox',
//         '--disable-setuid-sandbox',
//         '--disable-dev-shm-usage',
//         '--disable-gpu',
//       ],
//     })
//     logger.info('Puppeteer browser launched')
//   }
//   return browserInstance
// }
async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.connected) {
    // Find chromium on the system
    const possiblePaths = [
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      process.env.PUPPETEER_EXECUTABLE_PATH,
    ].filter(Boolean) as string[]

    let executablePath: string | undefined
    for (const p of possiblePaths) {
      try {
        const fs = await import('fs')
        if (fs.existsSync(p)) {
          executablePath = p
          break
        }
      } catch {}
    }

    // Fall back to puppeteer's own bundled chrome if nothing found
    if (!executablePath) {
      executablePath = puppeteer.executablePath()
    }

    logger.info({ executablePath }, 'Launching Puppeteer browser')

    browserInstance = await puppeteer.launch({
      headless: true,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
      ],
    })
    logger.info('Puppeteer browser launched')
  }
  return browserInstance
}
const generateSchema = z.object({
  resumeData: z.object({}).passthrough(),
  format: z.enum(['pdf']).default('pdf'),
})

export async function generateDocument(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const correlationId = req.correlationId ?? uuidv4()
  const log = logger.child({ correlationId, handler: 'generateDocument' })

  const parsed = generateSchema.safeParse(req.body)
  if (!parsed.success) {
    res
      .status(400)
      .json({ success: false, error: 'Invalid request body', correlationId })
    return
  }

  const resumeData = parsed.data.resumeData as unknown as ResumeData
  if (containsSuspiciousMarkup(resumeData)) {
    log.warn({ userId: req.user?.sub }, 'Suspicious markup in resume data')
    await publishEvent({
      eventType: 'user.flagged',
      correlationId,
      timestamp: new Date().toISOString(),
      payload: {
        userId: req.user!.sub,
        reason: 'malicious_input',
        detail: 'Script-like content submitted for PDF generation',
      },
    })
    // Still rendered — esc() neutralizes it — but the account is now flagged for review
  }
  log.info(
    { userId: req.user?.sub, template: resumeData.template },
    'Generating PDF',
  )

  const html = renderTemplate(resumeData)
  const browser = await getBrowser()
  const page = await browser.newPage()
  await page.setJavaScriptEnabled(false)

  try {
    await page.setContent(html, { waitUntil: 'networkidle0' })

    // Emulate print media for proper rendering
    await page.emulateMediaType('print')

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })

    const filename = `resume-${Date.now()}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('x-correlation-id', correlationId)
    res.send(Buffer.from(pdfBuffer))

    log.info(
      { userId: req.user?.sub, bytes: pdfBuffer.length },
      'PDF generated and sent',
    )
  } finally {
    await page.close()
  }
}

// Graceful browser cleanup
process.on('SIGTERM', async () => {
  if (browserInstance) {
    await browserInstance.close()
    logger.info('Puppeteer browser closed')
  }
})
