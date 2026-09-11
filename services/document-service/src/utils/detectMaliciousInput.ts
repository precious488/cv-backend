const SUSPICIOUS_PATTERNS = [
  /<script[\s>]/i,
  /on\w+\s*=/i, // onerror=, onload=, etc.
  /javascript:/i,
  /<iframe[\s>]/i,
  /data:text\/html/i,
]

export function containsSuspiciousMarkup(value: unknown): boolean {
  if (typeof value === 'string')
    return SUSPICIOUS_PATTERNS.some((p) => p.test(value))
  if (Array.isArray(value)) return value.some(containsSuspiciousMarkup)
  if (value && typeof value === 'object')
    return Object.values(value).some(containsSuspiciousMarkup)
  return false
}
