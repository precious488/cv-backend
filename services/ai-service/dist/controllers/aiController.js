"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.improveSummary = improveSummary;
exports.generateBulletPoints = generateBulletPoints;
exports.suggestSkills = suggestSkills;
exports.autocomplete = autocomplete;
const groq_sdk_1 = __importDefault(require("groq-sdk"));
const zod_1 = require("zod");
const shared_1 = require("@craft/shared");
const shared_2 = require("@craft/shared");
const crypto_1 = __importDefault(require("crypto"));
const uuid_1 = require("uuid");
const MODEL = 'llama-3.1-8b-instant';
let groqClient = null;
function getGroq() {
    if (!groqClient) {
        const key = process.env.GROQ_API_KEY;
        if (!key)
            throw new Error('GROQ_API_KEY is not set');
        groqClient = new groq_sdk_1.default({ apiKey: key });
    }
    return groqClient;
}
function hash(input) {
    return crypto_1.default.createHash('sha1').update(input).digest('hex').slice(0, 16);
}
async function callGroq(systemPrompt, userPrompt) {
    const completion = await getGroq().chat.completions.create({
        model: MODEL,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        max_tokens: 400,
        temperature: 0.7,
    });
    const text = completion.choices[0]?.message?.content?.trim() ?? '';
    return text.replace(/^["'"„""]+|["'"„""]+$/g, '').trim();
}
// ─── Improve summary ──────────────────────────────────────────
const summarySchema = zod_1.z.object({
    currentSummary: zod_1.z.string().max(2000),
    jobTitle: zod_1.z.string().max(200).optional(),
    skills: zod_1.z.array(zod_1.z.string()).max(30).optional(),
});
async function improveSummary(req, res) {
    const correlationId = req.correlationId ?? (0, uuid_1.v4)();
    const parsed = summarySchema.safeParse(req.body);
    if (!parsed.success) {
        res
            .status(400)
            .json({ success: false, error: 'Invalid request', correlationId });
        return;
    }
    const { currentSummary, jobTitle, skills } = parsed.data;
    const cacheKey = `ai:summary:${hash(currentSummary + (jobTitle ?? ''))}`;
    const result = await (0, shared_1.cacheAside)(cacheKey, async () => {
        const systemPrompt = `You are an expert resume writer. Rewrite the professional summary to be concise , impactful, ATS-friendly, and achievement-focused. Return ONLY the improved summary text. it should be 60-100 words.`;
        const userPrompt = `Job Title: ${jobTitle ?? 'Not specified'}
Skills: ${skills?.join(', ') ?? 'Not specified'}
Current Summary: "${currentSummary}"

Write an improved version:`;
        return callGroq(systemPrompt, userPrompt);
    }, 3600);
    res.json({ success: true, data: { improved: result }, correlationId });
}
// ─── Generate job description bullet points ───────────────────
const bulletSchema = zod_1.z.object({
    position: zod_1.z.string().max(200),
    company: zod_1.z.string().max(200).optional(),
    existingDescription: zod_1.z.string().max(2000).optional(),
    numberOfPoints: zod_1.z.number().min(1).max(6).default(3),
});
async function generateBulletPoints(req, res) {
    const correlationId = req.correlationId ?? (0, uuid_1.v4)();
    const parsed = bulletSchema.safeParse(req.body);
    if (!parsed.success) {
        res
            .status(400)
            .json({ success: false, error: 'Invalid request', correlationId });
        return;
    }
    const { position, company, existingDescription, numberOfPoints } = parsed.data;
    const cacheKey = `ai:bullets:${hash(position + (existingDescription ?? ''))}`;
    const result = await (0, shared_1.cacheAside)(cacheKey, async () => {
        const systemPrompt = `You are an expert resume writer. Generate ${numberOfPoints} strong, ATS-optimized bullet points for a resume entry (job role or project). Each bullet should start with a strong action verb, highlight impact, include quantifiable achievements where possible, and have 15 to 30 words characters. Tailor the bullets to the specific context provided.Return ONLY the bullet points, one per line, no numbering or dashes`;
        const userPrompt = `Position: ${position}
Company: ${company ?? 'Not specified'}
Existing context: "${existingDescription ?? 'None'}"

Generate ${numberOfPoints} bullet points:`;
        const text = await callGroq(systemPrompt, userPrompt);
        return text
            .split('\n')
            .filter((l) => l.trim().length > 10)
            .slice(0, numberOfPoints);
    }, 3600);
    res.json({ success: true, data: { bullets: result }, correlationId });
}
// ─── Suggest skills ───────────────────────────────────────────
const skillsSchema = zod_1.z.object({
    jobTitle: zod_1.z.string().max(200),
    existingSkills: zod_1.z.array(zod_1.z.string()).max(50).optional(),
    experience: zod_1.z.string().max(2000).optional(),
});
async function suggestSkills(req, res) {
    const correlationId = req.correlationId ?? (0, uuid_1.v4)();
    const parsed = skillsSchema.safeParse(req.body);
    if (!parsed.success) {
        res
            .status(400)
            .json({ success: false, error: 'Invalid request', correlationId });
        return;
    }
    const { jobTitle, existingSkills, experience } = parsed.data;
    const cacheKey = `ai:skills:${hash(jobTitle + (existingSkills?.join('') ?? ''))}`;
    const result = await (0, shared_1.cacheAside)(cacheKey, async () => {
        const systemPrompt = `You are a career advisor. Suggest relevant, in-demand skills for a resume. Return ONLY a JSON array of skill strings, no extra text. Example: ["TypeScript","Docker","REST APIs"]`;
        const userPrompt = `Job Title: ${jobTitle}
Already has: ${existingSkills?.join(', ') ?? 'None'}
Experience context: ${experience?.slice(0, 300) ?? 'None'}

Suggest 8-12 additional skills as a JSON array:`;
        const text = await callGroq(systemPrompt, userPrompt);
        const clean = text.replace(/```json|```/g, '').trim();
        return JSON.parse(clean);
    }, 7200);
    res.json({ success: true, data: { skills: result }, correlationId });
}
// ─── Autocomplete / inline suggestions ───────────────────────
const autocompleteSchema = zod_1.z.object({
    field: zod_1.z.enum(['summary', 'description', 'projectDescription']),
    partialText: zod_1.z.string().max(500),
    context: zod_1.z
        .object({
        jobTitle: zod_1.z.string().optional(),
        position: zod_1.z.string().optional(),
        company: zod_1.z.string().optional(),
    })
        .optional(),
});
async function autocomplete(req, res) {
    const correlationId = req.correlationId ?? (0, uuid_1.v4)();
    const parsed = autocompleteSchema.safeParse(req.body);
    if (!parsed.success) {
        res
            .status(400)
            .json({ success: false, error: 'Invalid request', correlationId });
        return;
    }
    const { field, partialText, context } = parsed.data;
    if (partialText.trim().length < 10) {
        res.json({ success: true, data: { suggestion: '' }, correlationId });
        return;
    }
    const systemPrompt = `You are an autocomplete engine for a resume builder. Complete the partial text naturally and professionally. Return ONLY the completion (not a repeat of the input). Keep it under 80 words.`;
    const userPrompt = `Field: ${field}
Context: ${JSON.stringify(context ?? {})}
Partial text: "${partialText}"

Complete this text:`;
    try {
        // No cache for autocomplete — too variable
        const suggestion = await callGroq(systemPrompt, userPrompt);
        res.json({ success: true, data: { suggestion }, correlationId });
    }
    catch (err) {
        shared_2.logger.warn({ err }, 'Autocomplete failed — returning empty');
        res.json({ success: true, data: { suggestion: '' }, correlationId });
    }
}
