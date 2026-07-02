"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderTemplate = renderTemplate;
const BASE_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #1a1a2e; }
  h1 { font-size: 22px; } h2 { font-size: 12px; } h3 { font-size: 12px; }
  a { color: inherit; text-decoration: none; }
  .section { margin-bottom: 16px; }
  .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid currentColor; padding-bottom: 4px; margin-bottom: 10px; }
  .item { margin-bottom: 10px; }
  .item-header { display: flex; justify-content: space-between; align-items: flex-start; }
  .item-title { font-weight: 600; }
  .item-subtitle { color: #666; font-size: 12px; }
  .item-date { font-size: 12px; color: #888; white-space: nowrap; }
  .item-desc { margin-top: 4px; font-size: 12px; color: #444; }
  .item-desc-line { display: flex; gap: 6px; margin-bottom: 2px; }
  .item-desc-bullet { color: #444; flex-shrink: 0; }
  .skills-list { display: flex; flex-wrap: wrap; gap: 6px; }
  .skill-tag { padding: 2px 8px; border-radius: 20px; font-size: 12px; }
`;
function esc(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function descLines(text) {
    if (!text)
        return '';
    return text
        .split('\n')
        .filter((l) => l.trim())
        .map((l) => {
        const clean = l.replace(/^[•\-\*]\s*/, '').trim();
        return `<div class="item-desc-line"><span class="item-desc-bullet">•</span><span>${esc(clean)}</span></div>`;
    })
        .join('');
}
// ─── MODERN template ──────────────────────────────────────────
function modernTemplate(d) {
    const p = d.personalInfo;
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
${BASE_CSS}
body { background: #fff; }
.header { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff; padding: 24px 28px; border-radius: 8px; margin-bottom: 20px; }
.header h1 { color: #fff; margin-bottom: 4px; }
.header .job-title { color: rgba(255,255,255,0.85); font-size: 13px; margin-bottom: 12px; }
.contact-row { display: flex; flex-wrap: wrap; gap: 14px; font-size: 12px; color: rgba(255,255,255,0.8); }
.body { padding: 0 28px 28px; }
.section-title { color: #4f46e5; border-color: #e0e7ff; }
.skill-tag { background: #ede9fe; color: #5b21b6; }
</style></head><body>
<div class="header">
  <h1>${esc(p.fullName) || 'Your Name'}</h1>
  <div class="job-title">${esc(p.title) || 'Professional Title'}</div>
  <div class="contact-row">
    ${p.email ? `<span> ${esc(p.email)}</span>` : ''}
    ${p.phone ? `<span>${esc(p.phone)}</span>` : ''}
    ${p.location ? `<span> ${esc(p.location)}</span>` : ''}
    ${p.website ? `<span> ${esc(p.website)}</span>` : ''}
    ${p.linkedin ? `<span>in ${esc(p.linkedin)}</span>` : ''}
  </div>
</div>
<div class="body">
  ${d.summary ? `<div class="section"><div class="section-title">Summary</div><p style="font-size:12px;color:#444">${esc(d.summary)}</p></div>` : ''}
  ${d.experience.length
        ? `<div class="section"><div class="section-title">Experience</div>${d.experience
            .map((e) => `
    <div class="item">
      <div class="item-header"><div><div class="item-title">${esc(e.position)}</div><div class="item-subtitle">${esc(e.company)}</div></div>
      <div class="item-date">${esc(e.startDate)} — ${e.current ? 'Present' : esc(e.endDate)}</div></div>
      ${e.description ? `<div class="item-desc">${descLines(e.description)}</div>` : ''}
    </div>`)
            .join('')}</div>`
        : ''}
  ${d.education.length
        ? `<div class="section"><div class="section-title">Education</div>${d.education
            .map((e) => `
    <div class="item">
      <div class="item-header"><div><div class="item-title">${esc(e.degree)} ${e.field ? `in ${esc(e.field)}` : ''}</div><div class="item-subtitle">${esc(e.school)}</div></div>
      <div class="item-date">${esc(e.startDate)} — ${esc(e.endDate)}</div></div>
      ${e.description ? `<div class="item-desc">${descLines(e.description)}</div>` : ''}
    </div>`)
            .join('')}</div>`
        : ''}
  ${d.skills.length ? `<div class="section"><div class="section-title">Skills</div><div class="skills-list">${d.skills.map((s) => `<span class="skill-tag">${esc(s)}</span>`).join('')}</div></div>` : ''}
  ${d.projects.length
        ? `<div class="section"><div class="section-title">Projects</div>${d.projects
            .map((p) => `
    <div class="item">
      <div class="item-header"><div class="item-title">${esc(p.name)}</div>${p.link ? `<a href="${esc(p.link)}" style="font-size:9px;color:#4f46e5">${esc(p.link)}</a>` : ''}</div>
      ${p.technologies ? `<div class="item-subtitle">${esc(p.technologies)}</div>` : ''}
      ${p.description ? `<div class="item-desc">${descLines(p.description)}</div>` : ''}
    </div>`)
            .join('')}</div>`
        : ''}
  ${d.certifications.length
        ? `<div class="section"><div class="section-title">Certifications</div>${d.certifications
            .map((c) => `
    <div class="item"><div class="item-header"><div class="item-title">${esc(c.name)}</div><div class="item-date">${esc(c.date)}</div></div>
    <div class="item-subtitle">${esc(c.issuer)}</div></div>`)
            .join('')}</div>`
        : ''}
  ${d.languages.length ? `<div class="section"><div class="section-title">Languages</div><div class="skills-list">${d.languages.map((l) => `<span class="skill-tag">${esc(l)}</span>`).join('')}</div></div>` : ''}
</div></body></html>`;
}
// ─── CLASSIC template ─────────────────────────────────────────
function classicTemplate(d) {
    const p = d.personalInfo;
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
${BASE_CSS}
body { padding: 32px; background: #fff; }
.header { text-align: center; border-bottom: 2px solid #1a1a2e; padding-bottom: 14px; margin-bottom: 18px; }
.header h1 { font-size: 24px; color: #1a1a2e; letter-spacing: 0.05em; }
.contact-row { display: flex; justify-content: center; gap: 16px; margin-top: 6px; font-size: 12px; color: #555; }
.section-title { color: #1a1a2e; border-color: #1a1a2e; }
.skill-tag { background: #f0f0f0; color: #333; }
</style></head><body>
<div class="header">
  <h1>${esc(p.fullName) || 'Your Name'}</h1>
  ${p.title ? `<div style="font-size:13px;color:#555;margin-top:4px">${esc(p.title)}</div>` : ''}
  <div class="contact-row">
    ${p.email ? `<span>${esc(p.email)}</span>` : ''}
    ${p.phone ? `<span>${esc(p.phone)}</span>` : ''}
    ${p.location ? `<span>${esc(p.location)}</span>` : ''}
    ${p.linkedin ? `<span>${esc(p.linkedin)}</span>` : ''}
  </div>
</div>
${d.summary ? `<div class="section"><div class="section-title">Professional Summary</div><p style="font-size:12px;color:#333">${esc(d.summary)}</p></div>` : ''}
${d.experience.length
        ? `<div class="section"><div class="section-title">Work Experience</div>${d.experience
            .map((e) => `
  <div class="item">
    <div class="item-header"><div><div class="item-title">${esc(e.position)}, <em>${esc(e.company)}</em></div></div>
    <div class="item-date">${esc(e.startDate)} – ${e.current ? 'Present' : esc(e.endDate)}</div></div>
   ${e.description ? `<div class="item-desc">${descLines(e.description)}</div>` : ''}
  </div>`)
            .join('')}</div>`
        : ''}
${d.education.length
        ? `<div class="section"><div class="section-title">Education</div>${d.education
            .map((e) => `
  <div class="item">
    <div class="item-header"><div class="item-title">${esc(e.school)}</div><div class="item-date">${esc(e.startDate)} – ${esc(e.endDate)}</div></div>
    <div class="item-subtitle">${esc(e.degree)}${e.field ? `, ${esc(e.field)}` : ''}</div>
  </div>`)
            .join('')}</div>`
        : ''}
${d.skills.length ? `<div class="section"><div class="section-title">Skills</div><div class="skills-list">${d.skills.map((s) => `<span class="skill-tag">${esc(s)}</span>`).join('')}</div></div>` : ''}
${d.certifications.length
        ? `<div class="section"><div class="section-title">Certifications</div>${d.certifications
            .map((c) => `
  <div class="item"><div class="item-header"><div class="item-title">${esc(c.name)}</div><div class="item-date">${esc(c.date)}</div></div>
  <div class="item-subtitle">${esc(c.issuer)}</div></div>`)
            .join('')}</div>`
        : ''}
  ${d.projects.length
        ? `<div class="section"><div class="section-title">Projects</div>${d.projects
            .map((p) => `
  <div class="item">
    <div class="item-header">
      <div class="item-title">${esc(p.name)}</div>
      ${p.link ? `<a href="${esc(p.link)}" style="font-size:9px;color:#1a1a2e">${esc(p.link)}</a>` : ''}
    </div>
    ${p.technologies ? `<div class="item-subtitle">${esc(p.technologies)}</div>` : ''}
    ${p.description ? `<div class="item-desc">${descLines(p.description)}</div>` : ''}
  </div>`)
            .join('')}</div>`
        : ''}
</body></html>`;
}
// ─── MINIMAL template ─────────────────────────────────────────
function minimalTemplate(d) {
    const p = d.personalInfo;
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
${BASE_CSS}
body { padding: 36px 40px; background: #fff; }
.resume-wrapper { max-width: 680px; margin: 0 auto; }
.header { margin-bottom: 24px; }
.header h1 { font-size: 26px; font-weight: 300; letter-spacing: 0.02em; }
.header .title { font-size: 13px; color: #888; margin-top: 2px; }
.contact-row { display: flex; gap: 16px; margin-top: 8px; font-size: 12px; color: #999; }
.section-title { color: #999; border-color: #e8e8e8; font-size: 9px; }
.item-title { font-weight: 500; }
.skill-tag { background: transparent; border: 1px solid #ddd; color: #555; }
</style></head><body>
<div class="resume-wrapper">
<div class="header">
  <h1>${esc(p.fullName) || 'Your Name'}</h1>
  ${p.title ? `<div class="title">${esc(p.title)}</div>` : ''}
  <div class="contact-row">
    ${[p.email, p.phone, p.location, p.website]
        .filter(Boolean)
        .map((v) => `<span>${esc(v)}</span>`)
        .join('')}
  </div>
</div>
${d.summary ? `<div class="section"><div class="section-title">About</div><p style="color:#555;font-size:12px">${esc(d.summary)}</p></div>` : ''}
${d.experience.length
        ? `<div class="section"><div class="section-title">Experience</div>${d.experience
            .map((e) => `
  <div class="item">
    <div class="item-header"><div class="item-title">${esc(e.position)} · ${esc(e.company)}</div>
    <div class="item-date">${esc(e.startDate)} – ${e.current ? 'Now' : esc(e.endDate)}</div></div>
    ${e.description ? `<div class="item-desc">${descLines(e.description)}</div>` : ''}
  </div>`)
            .join('')}</div>`
        : ''}
${d.education.length
        ? `<div class="section"><div class="section-title">Education</div>${d.education
            .map((e) => `
  <div class="item"><div class="item-header"><div class="item-title">${esc(e.school)}</div><div class="item-date">${esc(e.endDate)}</div></div>
  <div class="item-subtitle">${esc(e.degree)}${e.field ? ` · ${esc(e.field)}` : ''}</div></div>`)
            .join('')}</div>`
        : ''}
${d.skills.length ? `<div class="section"><div class="section-title">Skills</div><div class="skills-list">${d.skills.map((s) => `<span class="skill-tag">${esc(s)}</span>`).join('')}</div></div>` : ''}
</div>
</body></html>`;
}
// ─── CORPORATE template ───────────────────────────────────────
function corporateTemplate(d) {
    const p = d.personalInfo;
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
${BASE_CSS}
body { background: #fff; display: flex; min-height: 100vh; }
.sidebar { width: 200px; min-width: 200px; background: #1e293b; color: #e2e8f0; padding: 28px 18px; }
.sidebar h1 { font-size: 16px; color: #fff; line-height: 1.3; }
.sidebar .title { font-size: 12px; color: #94a3b8; margin-top: 4px; margin-bottom: 18px; }
.sidebar-section { margin-bottom: 16px; }
.sidebar-section-title { font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; margin-bottom: 6px; border-bottom: 1px solid #334155; padding-bottom: 3px; }
.sidebar p, .sidebar li { font-size: 12px; color: #cbd5e1; margin-bottom: 3px; list-style: none; }
.main { flex: 1; padding: 28px 24px; }
.section-title { color: #1e293b; border-color: #e2e8f0; }
.skill-tag { background: #f1f5f9; color: #334155; }
</style></head><body>
<div class="sidebar">
  <h1>${esc(p.fullName) || 'Your Name'}</h1>
  <div class="title">${esc(p.title) || ''}</div>
  <div class="sidebar-section"><div class="sidebar-section-title">Contact</div>
    ${p.email ? `<p>✉ ${esc(p.email)}</p>` : ''}
    ${p.phone ? `<p> ${esc(p.phone)}</p>` : ''}
    ${p.location ? `<p> ${esc(p.location)}</p>` : ''}
    ${p.linkedin ? `<p>in ${esc(p.linkedin)}</p>` : ''}
  </div>
  ${d.skills.length ? `<div class="sidebar-section"><div class="sidebar-section-title">Skills</div>${d.skills.map((s) => `<p>• ${esc(s)}</p>`).join('')}</div>` : ''}
  ${d.languages.length ? `<div class="sidebar-section"><div class="sidebar-section-title">Languages</div>${d.languages.map((l) => `<p>${esc(l)}</p>`).join('')}</div>` : ''}
  ${d.certifications.length ? `<div class="sidebar-section"><div class="sidebar-section-title">Certifications</div>${d.certifications.map((c) => `<p>${esc(c.name)}</p>`).join('')}</div>` : ''}
</div>
<div class="main">
  ${d.summary ? `<div class="section"><div class="section-title">Executive Summary</div><p style="font-size:12px;color:#444">${esc(d.summary)}</p></div>` : ''}
  ${d.experience.length
        ? `<div class="section"><div class="section-title">Professional Experience</div>${d.experience
            .map((e) => `
    <div class="item">
      <div class="item-header"><div><div class="item-title">${esc(e.position)}</div><div class="item-subtitle">${esc(e.company)}</div></div>
      <div class="item-date">${esc(e.startDate)} — ${e.current ? 'Present' : esc(e.endDate)}</div></div>
      ${e.description ? `<div class="item-desc">${descLines(e.description)}</div>` : ''}
    </div>`)
            .join('')}</div>`
        : ''}
  ${d.education.length
        ? `<div class="section"><div class="section-title">Education</div>${d.education
            .map((e) => `
    <div class="item">
      <div class="item-header"><div><div class="item-title">${esc(e.degree)}${e.field ? ` — ${esc(e.field)}` : ''}</div><div class="item-subtitle">${esc(e.school)}</div></div>
      <div class="item-date">${esc(e.startDate)} – ${esc(e.endDate)}</div></div>
    </div>`)
            .join('')}</div>`
        : ''}
  ${d.projects.length
        ? `<div class="section"><div class="section-title">Key Projects</div>${d.projects
            .map((p) => `
    <div class="item"><div class="item-title">${esc(p.name)}</div>
    ${p.technologies ? `<div class="item-subtitle">${esc(p.technologies)}</div>` : ''}
    ${p.description ? `<div class="item-desc">${descLines(p.description)}</div>` : ''}</div>`)
            .join('')}</div>`
        : ''}
</div></body></html>`;
}
// ─── Template selector ────────────────────────────────────────
function renderTemplate(data) {
    switch (data.template) {
        case 'classic':
            return classicTemplate(data);
        case 'minimal':
            return minimalTemplate(data);
        case 'corporate':
            return corporateTemplate(data);
        default:
            return modernTemplate(data);
    }
}
