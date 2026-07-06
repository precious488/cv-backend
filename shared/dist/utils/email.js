"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
/**
 * email.ts
 * Sends transactional email over HTTPS via the Brevo API instead of raw SMTP.
 *
 * Why: many hosts (Render included) block outbound SMTP ports (25/465/587)
 * on free/low-tier instances to prevent spam abuse. HTTPS (443) is never
 * blocked, so an HTTP-based provider sidesteps that entirely.
 *
 * Why Brevo specifically: it only requires verifying a single sender email
 * address (a 6-digit code sent to that inbox) — no domain purchase or DNS
 * setup needed — and that verified sender can then email any recipient.
 * Free tier: 300 emails/day, no expiration.
 *
 * Required env vars:
 *   BREVO_API_KEY    - from Brevo dashboard → Settings → SMTP & API → API Keys
 *   EMAIL_FROM       - the exact email address you verified in Brevo
 *                      (Settings → Senders, Domains & Dedicated IPs → Senders)
 *   EMAIL_FROM_NAME  - display name, e.g. 'ResumeAI' (optional, defaults below)
 */
const logger_1 = require("./logger");
async function sendEmail(input) {
    const apiKey = process.env.BREVO_API_KEY;
    const fromEmail = process.env.EMAIL_FROM;
    const fromName = process.env.EMAIL_FROM_NAME ?? 'ResumeAI';
    if (!apiKey) {
        throw new Error('BREVO_API_KEY is not set');
    }
    if (!fromEmail) {
        throw new Error('EMAIL_FROM is not set');
    }
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({
            sender: { name: fromName, email: fromEmail },
            to: [{ email: input.to }],
            subject: input.subject,
            textContent: input.text,
            htmlContent: input.html,
        }),
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        logger_1.logger.error({ status: res.status, body }, 'Brevo email send failed');
        throw new Error(`Brevo API error ${res.status}: ${body}`);
    }
    logger_1.logger.info({ to: input.to }, 'Email sent via Brevo');
}
