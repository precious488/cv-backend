"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDocument = generateDocument;
const puppeteer_1 = __importDefault(require("puppeteer"));
const zod_1 = require("zod");
const htmlTemplates_1 = require("../templates/htmlTemplates");
const shared_1 = require("@craft/shared");
const uuid_1 = require("uuid");
let browserInstance = null;
async function getBrowser() {
    if (!browserInstance || !browserInstance.connected) {
        browserInstance = await puppeteer_1.default.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
            ],
        });
        shared_1.logger.info('Puppeteer browser launched');
    }
    return browserInstance;
}
const generateSchema = zod_1.z.object({
    resumeData: zod_1.z.object({}).passthrough(),
    format: zod_1.z.enum(['pdf']).default('pdf'),
});
async function generateDocument(req, res) {
    const correlationId = req.correlationId ?? (0, uuid_1.v4)();
    const log = shared_1.logger.child({ correlationId, handler: 'generateDocument' });
    const parsed = generateSchema.safeParse(req.body);
    if (!parsed.success) {
        res
            .status(400)
            .json({ success: false, error: 'Invalid request body', correlationId });
        return;
    }
    const resumeData = parsed.data.resumeData;
    log.info({ userId: req.user?.sub, template: resumeData.template }, 'Generating PDF');
    const html = (0, htmlTemplates_1.renderTemplate)(resumeData);
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
        await page.setContent(html, { waitUntil: 'networkidle0' });
        // Emulate print media for proper rendering
        await page.emulateMediaType('print');
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' },
        });
        const filename = `resume-${Date.now()}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('x-correlation-id', correlationId);
        res.send(Buffer.from(pdfBuffer));
        log.info({ userId: req.user?.sub, bytes: pdfBuffer.length }, 'PDF generated and sent');
    }
    finally {
        await page.close();
    }
}
// Graceful browser cleanup
process.on('SIGTERM', async () => {
    if (browserInstance) {
        await browserInstance.close();
        shared_1.logger.info('Puppeteer browser closed');
    }
});
