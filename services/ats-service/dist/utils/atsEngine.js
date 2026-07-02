"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreResume = scoreResume;
exports.hashJobDescription = hashJobDescription;
const crypto_1 = __importDefault(require("crypto"));
const ACTION_VERBS = [
    'achieved', 'built', 'created', 'designed', 'developed', 'enhanced', 'established',
    'generated', 'implemented', 'improved', 'increased', 'launched', 'led', 'managed',
    'optimized', 'reduced', 'streamlined', 'delivered', 'coordinated', 'drove',
    'executed', 'facilitated', 'founded', 'grew', 'handled', 'identified', 'initiated',
    'mentored', 'monitored', 'negotiated', 'organized', 'oversaw', 'planned', 'produced',
    'provided', 'resolved', 'restructured', 'scaled', 'spearheaded', 'supervised',
    'transformed', 'utilized', 'validated',
];
const QUANTIFIER_REGEX = /(\d+%|\d+x|\$\d+|\d+\+|\d+ (users|clients|people|team|projects|months|years|k|million))/gi;
function tokenize(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s+#]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 2);
}
function textOf(resume) {
    return [
        resume.summary,
        ...resume.experience.map((e) => `${e.position} ${e.description}`),
        ...resume.education.map((e) => `${e.degree} ${e.field}`),
        resume.skills.join(' '),
        ...resume.projects.map((p) => `${p.description} ${p.technologies}`),
    ].join(' ');
}
function scoreResume(resume, jobDescription) {
    const resumeText = textOf(resume);
    const resumeTokens = new Set(tokenize(resumeText));
    // ─── Keyword match ───────────────────────────────────────────
    let keywordScore = 0;
    let matchedKeywords = [];
    let missingKeywords = [];
    if (jobDescription && jobDescription.trim()) {
        const jdTokens = tokenize(jobDescription);
        // Take top 50 meaningful JD terms (remove stopwords)
        const stopwords = new Set(['and', 'the', 'for', 'with', 'this', 'that', 'have', 'from', 'are', 'will', 'you', 'our', 'your', 'can', 'all', 'has', 'been', 'was', 'not', 'but', 'they', 'their', 'more', 'also']);
        const jdKeywords = [...new Set(jdTokens.filter((t) => !stopwords.has(t) && t.length > 3))].slice(0, 50);
        matchedKeywords = jdKeywords.filter((k) => resumeTokens.has(k));
        missingKeywords = jdKeywords.filter((k) => !resumeTokens.has(k)).slice(0, 10);
        keywordScore = jdKeywords.length > 0 ? Math.round((matchedKeywords.length / jdKeywords.length) * 100) : 75;
    }
    else {
        // No JD provided — score based on general best practices
        const generalKeywords = ['experience', 'skills', 'education', 'achievements', 'leadership', 'communication', 'collaboration', 'problem-solving'];
        matchedKeywords = generalKeywords.filter((k) => resumeTokens.has(k));
        keywordScore = 75; // neutral when no JD
    }
    // ─── Section completeness ─────────────────────────────────────
    const sectionScores = {
        contact: 0, summary: 0, experience: 0, education: 0, skills: 0,
    };
    const p = resume.personalInfo;
    const contactFields = [p.fullName, p.email, p.phone, p.location].filter(Boolean).length;
    sectionScores.contact = Math.round((contactFields / 4) * 100);
    sectionScores.summary = resume.summary && resume.summary.length > 50 ? 100 : resume.summary ? 50 : 0;
    sectionScores.experience = resume.experience.length >= 2 ? 100 : resume.experience.length === 1 ? 60 : 0;
    sectionScores.education = resume.education.length >= 1 ? 100 : 0;
    sectionScores.skills = resume.skills.length >= 5 ? 100 : resume.skills.length > 0 ? Math.round((resume.skills.length / 5) * 100) : 0;
    const sectionCompleteness = Math.round(Object.values(sectionScores).reduce((a, b) => a + b, 0) / Object.keys(sectionScores).length);
    // ─── Action verbs ─────────────────────────────────────────────
    const expText = resume.experience.map((e) => e.description.toLowerCase()).join(' ');
    const foundVerbs = ACTION_VERBS.filter((v) => expText.includes(v));
    const actionVerbScore = Math.min(100, Math.round((foundVerbs.length / 8) * 100));
    // ─── Quantifiable achievements ────────────────────────────────
    const quantMatches = expText.match(QUANTIFIER_REGEX) ?? [];
    const quantScore = Math.min(100, Math.round((quantMatches.length / 5) * 100));
    // ─── Formatting (heuristic based on data completeness) ───────
    const hasLinkedIn = !!p.title;
    const hasMultipleSkills = resume.skills.length >= 8;
    const hasProjects = resume.projects.length > 0;
    const formattingScore = Math.round(([hasLinkedIn, hasMultipleSkills, hasProjects, sectionScores.contact === 100, !!resume.summary].filter(Boolean).length / 5) * 100);
    // ─── Overall score (weighted) ─────────────────────────────────
    const overallScore = Math.round(keywordScore * 0.35 +
        sectionCompleteness * 0.25 +
        actionVerbScore * 0.15 +
        quantScore * 0.15 +
        formattingScore * 0.10);
    // ─── Suggestions ─────────────────────────────────────────────
    const suggestions = [];
    if (sectionScores.summary < 50)
        suggestions.push('Add a compelling professional summary (2–4 sentences) to pass initial screening.');
    if (actionVerbScore < 60)
        suggestions.push(`Use more action verbs in experience descriptions. Try: ${ACTION_VERBS.slice(0, 6).join(', ')}.`);
    if (quantScore < 40)
        suggestions.push('Add quantifiable achievements (e.g., "Reduced load time by 40%", "Led team of 5").');
    if (resume.skills.length < 6)
        suggestions.push('Expand your skills section — ATS systems scan for specific technical keywords.');
    if (missingKeywords.length > 0)
        suggestions.push(`Your resume is missing key terms from the job posting: ${missingKeywords.slice(0, 5).join(', ')}.`);
    if (sectionScores.contact < 100)
        suggestions.push('Complete your contact information (name, email, phone, location).');
    if (!hasProjects && resume.experience.length < 2)
        suggestions.push('Add projects to strengthen your profile.');
    return {
        overallScore,
        breakdown: {
            keywordMatch: keywordScore,
            sectionCompleteness,
            formattingScore,
            quantifiableAchievements: quantScore,
            actionVerbs: actionVerbScore,
        },
        matchedKeywords: matchedKeywords.slice(0, 20),
        missingKeywords,
        suggestions,
        sectionScores,
    };
}
/** Hash job description for cache key deduplication */
function hashJobDescription(jd) {
    return crypto_1.default.createHash('sha1').update(jd.trim().toLowerCase()).digest('hex').slice(0, 12);
}
