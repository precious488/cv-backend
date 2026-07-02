"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeResume = analyzeResume;
const zod_1 = require("zod");
const atsEngine_1 = require("../utils/atsEngine");
const shared_1 = require("@craft/shared");
const uuid_1 = require("uuid");
const analyzeSchema = zod_1.z.object({
    resumeData: zod_1.z.object({}).passthrough(),
    jobDescription: zod_1.z.string().max(10000).optional(),
    cvId: zod_1.z.string().optional(),
});
async function analyzeResume(req, res) {
    const correlationId = req.correlationId ?? (0, uuid_1.v4)();
    const parsed = analyzeSchema.safeParse(req.body);
    if (!parsed.success) {
        res
            .status(400)
            .json({ success: false, error: 'Invalid request', correlationId });
        return;
    }
    const { resumeData, jobDescription, cvId } = parsed.data;
    const jdHash = jobDescription ? (0, atsEngine_1.hashJobDescription)(jobDescription) : 'nojd';
    // Cache ATS results — they're expensive but stable for same data
    const cacheKey = cvId
        ? shared_1.cacheKeys.atsScore(cvId, jdHash)
        : `ats:anon:${req.user.sub}:${jdHash}`;
    const result = await (0, shared_1.cacheAside)(cacheKey, () => Promise.resolve((0, atsEngine_1.scoreResume)(resumeData, jobDescription)), 600);
    res.json({ success: true, data: result, correlationId });
}
