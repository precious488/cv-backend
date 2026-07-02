"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCircuitBreaker = getCircuitBreaker;
exports.getCircuitBreakerStats = getCircuitBreakerStats;
const opossum_1 = __importDefault(require("opossum"));
const shared_1 = require("@craft/shared");
const DEFAULT_OPTIONS = {
    timeout: 10000, // 10s — if service takes longer, fail fast
    errorThresholdPercentage: 50, // open circuit after 50% failures
    resetTimeout: 30000, // try again after 30s
    volumeThreshold: 5, // min 5 requests before evaluating
};
const breakers = new Map();
function getCircuitBreaker(serviceName, fn, options) {
    if (breakers.has(serviceName))
        return breakers.get(serviceName);
    const breaker = new opossum_1.default(fn, { ...DEFAULT_OPTIONS, ...options });
    breaker.on('open', () => shared_1.logger.warn({ service: serviceName }, 'Circuit OPEN — failing fast'));
    breaker.on('halfOpen', () => shared_1.logger.info({ service: serviceName }, 'Circuit HALF-OPEN — testing'));
    breaker.on('close', () => shared_1.logger.info({ service: serviceName }, 'Circuit CLOSED — service recovered'));
    breaker.on('fallback', () => shared_1.logger.warn({ service: serviceName }, 'Circuit fallback triggered'));
    breakers.set(serviceName, breaker);
    return breaker;
}
function getCircuitBreakerStats() {
    const stats = {};
    for (const [name, breaker] of breakers.entries()) {
        stats[name] = breaker.stats;
    }
    return stats;
}
