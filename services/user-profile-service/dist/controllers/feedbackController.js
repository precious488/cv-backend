"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitFeedback = submitFeedback;
exports.getMyFeedback = getMyFeedback;
exports.getPublishedFeedback = getPublishedFeedback;
exports.getAllFeedbackAdmin = getAllFeedbackAdmin;
exports.setFeedbackPublished = setFeedbackPublished;
exports.deleteFeedbackAdmin = deleteFeedbackAdmin;
const zod_1 = require("zod");
const Feedback_1 = require("../models/Feedback");
const shared_1 = require("@craft/shared");
const uuid_1 = require("uuid");
const MAX_PHOTO_BYTES = 1_500_000;
const feedbackSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Name is required').max(100),
    location: zod_1.z.string().max(100).default(''),
    jobTitle: zod_1.z.string().max(150).default(''),
    message: zod_1.z.string().min(10, 'Please share a bit more detail').max(1000),
    rating: zod_1.z.number().min(1).max(5).optional(),
    photoUrl: zod_1.z
        .string()
        .optional()
        .refine((val) => {
        if (!val)
            return true;
        if (!val.startsWith('data:image/'))
            return false;
        return val.length * 0.75 <= MAX_PHOTO_BYTES;
    }, { message: 'Photo must be a valid image under ~1.5MB' }),
});
async function submitFeedback(req, res) {
    const correlationId = req.correlationId ?? (0, uuid_1.v4)();
    const userId = req.user.sub;
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: parsed.error.flatten().fieldErrors,
            correlationId,
        });
        return;
    }
    const feedback = new Feedback_1.Feedback({ ...parsed.data, userId });
    await feedback.save();
    shared_1.logger.info({ userId, feedbackId: feedback.id, hasPhoto: !!parsed.data.photoUrl }, 'Feedback submitted');
    res.status(201).json({ success: true, data: feedback, correlationId });
}
async function getMyFeedback(req, res) {
    const correlationId = req.correlationId ?? (0, uuid_1.v4)();
    const userId = req.user.sub;
    const feedback = await Feedback_1.Feedback.find({ userId })
        .sort({ createdAt: -1 })
        .lean();
    res.json({ success: true, data: feedback, correlationId });
}
async function getPublishedFeedback(req, res) {
    const correlationId = req.correlationId ?? (0, uuid_1.v4)();
    const feedback = await Feedback_1.Feedback.find({ isPublished: true })
        .sort({ createdAt: -1 })
        .limit(12)
        .select('name location jobTitle message rating photoUrl createdAt')
        .lean();
    res.json({ success: true, data: feedback, correlationId });
}
async function getAllFeedbackAdmin(req, res) {
    const correlationId = req.correlationId ?? (0, uuid_1.v4)();
    if (req.user.role !== 'admin') {
        res
            .status(403)
            .json({ success: false, error: 'Admin access required', correlationId });
        return;
    }
    const feedback = await Feedback_1.Feedback.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: feedback, correlationId });
}
async function setFeedbackPublished(req, res) {
    const correlationId = req.correlationId ?? (0, uuid_1.v4)();
    if (req.user.role !== 'admin') {
        res
            .status(403)
            .json({ success: false, error: 'Admin access required', correlationId });
        return;
    }
    const { id } = req.params;
    const { isPublished } = req.body;
    const feedback = await Feedback_1.Feedback.findByIdAndUpdate(id, { $set: { isPublished: !!isPublished } }, { new: true });
    if (!feedback) {
        res
            .status(404)
            .json({ success: false, error: 'Feedback not found', correlationId });
        return;
    }
    shared_1.logger.info({ feedbackId: id, isPublished, adminId: req.user.sub }, 'Feedback publish status changed');
    res.json({ success: true, data: feedback, correlationId });
}
async function deleteFeedbackAdmin(req, res) {
    const correlationId = req.correlationId ?? (0, uuid_1.v4)();
    if (req.user.role !== 'admin') {
        res
            .status(403)
            .json({ success: false, error: 'Admin access required', correlationId });
        return;
    }
    const { id } = req.params;
    await Feedback_1.Feedback.findByIdAndDelete(id);
    res.json({ success: true, message: 'Feedback deleted', correlationId });
}
