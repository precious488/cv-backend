"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listResumes = listResumes;
exports.getResume = getResume;
exports.createResume = createResume;
exports.updateResume = updateResume;
exports.deleteResume = deleteResume;
exports.duplicateResume = duplicateResume;
const zod_1 = require("zod");
const Resume_1 = require("../models/Resume");
const shared_1 = require("@craft/shared");
const shared_2 = require("@craft/shared");
const shared_3 = require("@craft/shared");
const uuid_1 = require("uuid");
// ─── Validation ───────────────────────────────────────────────
const personalInfoSchema = zod_1.z.object({
    fullName: zod_1.z.string().max(150).default(''),
    email: zod_1.z.string().max(200).default(''),
    phone: zod_1.z.string().max(50).default(''),
    location: zod_1.z.string().max(200).default(''),
    title: zod_1.z.string().max(200).default(''),
    website: zod_1.z.string().max(500).default(''),
    linkedin: zod_1.z.string().max(500).default(''),
});
const experienceSchema = zod_1.z.object({
    id: zod_1.z.string(),
    company: zod_1.z.string().max(200).default(''),
    position: zod_1.z.string().max(200).default(''),
    startDate: zod_1.z.string().max(50).default(''),
    endDate: zod_1.z.string().max(50).default(''),
    current: zod_1.z.boolean().default(false),
    description: zod_1.z.string().max(5000).default(''),
});
const educationSchema = zod_1.z.object({
    id: zod_1.z.string(),
    school: zod_1.z.string().max(200).default(''),
    degree: zod_1.z.string().max(200).default(''),
    field: zod_1.z.string().max(200).default(''),
    startDate: zod_1.z.string().max(50).default(''),
    endDate: zod_1.z.string().max(50).default(''),
    description: zod_1.z.string().max(2000).default(''),
});
const projectSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string().max(200).default(''),
    description: zod_1.z.string().max(2000).default(''),
    technologies: zod_1.z.string().max(500).default(''),
    link: zod_1.z.string().max(500).default(''),
});
const certificationSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string().max(200).default(''),
    issuer: zod_1.z.string().max(200).default(''),
    date: zod_1.z.string().max(50).default(''),
});
const resumeSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200).default('Untitled Resume'),
    personalInfo: personalInfoSchema.default({}),
    summary: zod_1.z.string().max(2000).default(''),
    experience: zod_1.z.array(experienceSchema).default([]),
    education: zod_1.z.array(educationSchema).default([]),
    skills: zod_1.z.array(zod_1.z.string().max(100)).max(100).default([]),
    projects: zod_1.z.array(projectSchema).default([]),
    certifications: zod_1.z.array(certificationSchema).default([]),
    languages: zod_1.z.array(zod_1.z.string().max(100)).max(50).default([]),
    template: zod_1.z
        .enum(['modern', 'classic', 'minimal', 'corporate'])
        .default('modern'),
});
// ─── List resumes ─────────────────────────────────────────────
async function listResumes(req, res) {
    const correlationId = req.correlationId ?? (0, uuid_1.v4)();
    const userId = req.user.sub;
    const resumes = await (0, shared_1.cacheAside)(shared_1.cacheKeys.cvList(userId), () => Resume_1.Resume.find({ userId }).sort({ updatedAt: -1 }).lean(), 120);
    res.json({ success: true, data: resumes, correlationId });
}
// ─── Get one resume ───────────────────────────────────────────
async function getResume(req, res) {
    const correlationId = req.correlationId ?? (0, uuid_1.v4)();
    const userId = req.user.sub;
    const { id } = req.params;
    const resume = await (0, shared_1.cacheAside)(shared_1.cacheKeys.cv(id), async () => {
        const doc = await Resume_1.Resume.findOne({ _id: id, userId }).lean();
        return doc;
    }, 300);
    if (!resume) {
        res
            .status(404)
            .json({ success: false, error: 'Resume not found', correlationId });
        return;
    }
    res.json({ success: true, data: resume, correlationId });
}
// ─── Create resume ────────────────────────────────────────────
async function createResume(req, res) {
    const correlationId = req.correlationId ?? (0, uuid_1.v4)();
    const userId = req.user.sub;
    // Check plan limits: free users max 3 resumes
    // if (//req.user!.role === 'free') {
    //   const count = await Resume.countDocuments({ userId })
    //   if (count >= 3) {
    //     res.status(403).json({
    //       success: false,
    //       error:
    //         'Free plan allows a maximum of 3 resumes. Upgrade to Pro for unlimited resumes.',
    //       correlationId,
    //     })
    //     return
    //   }
    // }
    const parsed = resumeSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: parsed.error.flatten().fieldErrors,
            correlationId,
        });
        return;
    }
    const resume = new Resume_1.Resume({ ...parsed.data, userId });
    await resume.save();
    // Write-through: invalidate the list cache
    await (0, shared_1.invalidateCache)(shared_1.cacheKeys.cvList(userId));
    await (0, shared_2.publishEvent)({
        eventType: 'cv.created',
        correlationId,
        timestamp: new Date().toISOString(),
        payload: { cvId: resume.id, userId, cacheKey: shared_1.cacheKeys.cv(resume.id) },
    });
    shared_3.logger.info({ cvId: resume.id, userId }, 'CV created');
    res.status(201).json({ success: true, data: resume, correlationId });
}
// ─── Update resume ────────────────────────────────────────────
async function updateResume(req, res) {
    const correlationId = req.correlationId ?? (0, uuid_1.v4)();
    const userId = req.user.sub;
    const { id } = req.params;
    const parsed = resumeSchema.partial().safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: parsed.error.flatten().fieldErrors,
            correlationId,
        });
        return;
    }
    const resume = await Resume_1.Resume.findOneAndUpdate({ _id: id, userId }, { $set: parsed.data }, { new: true, runValidators: true }).lean();
    if (!resume) {
        res
            .status(404)
            .json({ success: false, error: 'Resume not found', correlationId });
        return;
    }
    // ─── Write-through cache invalidation (CRITICAL) ──────────
    await (0, shared_1.invalidateCache)(shared_1.cacheKeys.cv(id), shared_1.cacheKeys.cvList(userId));
    await (0, shared_2.publishEvent)({
        eventType: 'cv.updated',
        correlationId,
        timestamp: new Date().toISOString(),
        payload: { cvId: id, userId, cacheKey: shared_1.cacheKeys.cv(id) },
    });
    shared_3.logger.info({ cvId: id, userId }, 'CV updated');
    res.json({ success: true, data: resume, correlationId });
}
// ─── Delete resume ────────────────────────────────────────────
async function deleteResume(req, res) {
    const correlationId = req.correlationId ?? (0, uuid_1.v4)();
    const userId = req.user.sub;
    const { id } = req.params;
    const deleted = await Resume_1.Resume.findOneAndDelete({ _id: id, userId });
    if (!deleted) {
        res
            .status(404)
            .json({ success: false, error: 'Resume not found', correlationId });
        return;
    }
    // Write-through: invalidate both specific and list caches
    await (0, shared_1.invalidateCache)(shared_1.cacheKeys.cv(id), shared_1.cacheKeys.cvList(userId));
    // Also invalidate any ATS scores for this CV
    await (0, shared_1.invalidateCachePattern)(`ats:${id}:*`);
    await (0, shared_2.publishEvent)({
        eventType: 'cv.deleted',
        correlationId,
        timestamp: new Date().toISOString(),
        payload: { cvId: id, userId, cacheKey: shared_1.cacheKeys.cv(id) },
    });
    shared_3.logger.info({ cvId: id, userId }, 'CV deleted');
    res.json({ success: true, message: 'Resume deleted', correlationId });
}
// ─── Duplicate resume ─────────────────────────────────────────
async function duplicateResume(req, res) {
    const correlationId = req.correlationId ?? (0, uuid_1.v4)();
    const userId = req.user.sub;
    const { id } = req.params;
    const original = await Resume_1.Resume.findOne({ _id: id, userId }).lean();
    if (!original) {
        res
            .status(404)
            .json({ success: false, error: 'Resume not found', correlationId });
        return;
    }
    const { _id, createdAt, updatedAt, ...rest } = original;
    void _id;
    void createdAt;
    void updatedAt;
    const copy = new Resume_1.Resume({
        ...rest,
        title: `${original.title} (Copy)`,
        userId,
    });
    await copy.save();
    await (0, shared_1.invalidateCache)(shared_1.cacheKeys.cvList(userId));
    res.status(201).json({ success: true, data: copy, correlationId });
}
