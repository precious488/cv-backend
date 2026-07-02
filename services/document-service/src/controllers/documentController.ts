import { Response } from 'express'
import puppeteer, { Browser } from 'puppeteer'
import { z } from 'zod'
import { renderTemplate, ResumeData } from '../templates/htmlTemplates'
import { AuthenticatedRequest } from '@craft/shared'
import { logger } from '@craft/shared'
import { v4 as uuidv4 } from 'uuid'

let browserInstance: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.connected) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
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
  log.info(
    { userId: req.user?.sub, template: resumeData.template },
    'Generating PDF',
  )

  const html = renderTemplate(resumeData)
  const browser = await getBrowser()
  const page = await browser.newPage()

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
