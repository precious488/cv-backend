"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfile = getProfile;
exports.updateProfile = updateProfile;
exports.deleteAccount = deleteAccount;
const zod_1 = require("zod");
const UserProfile_1 = require("../models/UserProfile");
const shared_1 = require("@craft/shared");
const shared_2 = require("@craft/shared");
const uuid_1 = require("uuid");
const updateSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(2).max(100).optional(),
    bio: zod_1.z.string().max(500).optional(),
    jobTitle: zod_1.z.string().max(200).optional(),
    location: zod_1.z.string().max(200).optional(),
    website: zod_1.z.string().url().max(500).optional().or(zod_1.z.literal('')),
    linkedin: zod_1.z.string().max(500).optional(),
    github: zod_1.z.string().max(500).optional(),
    phone: zod_1.z.string().max(50).optional(),
    preferences: zod_1.z
        .object({
        defaultTemplate: zod_1.z
            .enum(['modern', 'classic', 'minimal', 'corporate'])
            .optional(),
        emailNotifications: zod_1.z.boolean().optional(),
        theme: zod_1.z.enum(['light', 'dark', 'system']).optional(),
    })
        .optional(),
});
async function getProfile(req, res) {
    const correlationId = req.correlationId ?? (0, uuid_1.v4)();
    const userId = req.user.sub;
    const profile = await (0, shared_1.cacheAside)(shared_1.cacheKeys.profile(userId), () => UserProfile_1.UserProfile.findOne({ userId }).lean(), 300);
    if (!profile) {
        res
            .status(404)
            .json({ success: false, error: 'Profile not found', correlationId });
        return;
    }
    res.json({ success: true, data: profile, correlationId });
}
async function updateProfile(req, res) {
    const correlationId = req.correlationId ?? (0, uuid_1.v4)();
    const userId = req.user.sub;
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: parsed.error.flatten().fieldErrors,
            correlationId,
        });
        return;
    }
    const profile = await UserProfile_1.UserProfile.findOneAndUpdate({ userId }, { $set: parsed.data }, { new: true, upsert: true, runValidators: true }).lean();
    // Write-through cache invalidation
    await (0, shared_1.invalidateCache)(shared_1.cacheKeys.profile(userId));
    shared_2.logger.info({ userId }, 'Profile updated');
    res.json({ success: true, data: profile, correlationId });
}
async function deleteAccount(req, res) {
    const correlationId = req.correlationId ?? (0, uuid_1.v4)();
    const userId = req.user.sub;
    await UserProfile_1.UserProfile.findOneAndDelete({ userId });
    await (0, shared_1.invalidateCache)(shared_1.cacheKeys.profile(userId));
    shared_2.logger.info({ userId }, 'Profile deleted (account removal)');
    res.json({ success: true, message: 'Account data removed', correlationId });
}
