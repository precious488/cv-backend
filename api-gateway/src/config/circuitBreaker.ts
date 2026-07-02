import CircuitBreaker from 'opossum'
import { logger } from '@craft/shared'

const DEFAULT_OPTIONS: CircuitBreaker.Options = {
  timeout: 10000, // 10s — if service takes longer, fail fast
  errorThresholdPercentage: 50, // open circuit after 50% failures
  resetTimeout: 30000, // try again after 30s
  volumeThreshold: 5, // min 5 requests before evaluating
}

const breakers = new Map<string, CircuitBreaker>()

export function getCircuitBreaker(
  serviceName: string,
  fn: (...args: unknown[]) => Promise<unknown>,
  options?: Partial<CircuitBreaker.Options>,
): CircuitBreaker {
  if (breakers.has(serviceName)) return breakers.get(serviceName)!

  const breaker = new CircuitBreaker(fn, { ...DEFAULT_OPTIONS, ...options })

  breaker.on('open', () =>
    logger.warn({ service: serviceName }, 'Circuit OPEN — failing fast'),
  )
  breaker.on('halfOpen', () =>
    logger.info({ service: serviceName }, 'Circuit HALF-OPEN — testing'),
  )
  breaker.on('close', () =>
    logger.info({ service: serviceName }, 'Circuit CLOSED — service recovered'),
  )
  breaker.on('fallback', () =>
    logger.warn({ service: serviceName }, 'Circuit fallback triggered'),
  )

  breakers.set(serviceName, breaker)
  return breaker
}

export function getCircuitBreakerStats(): Record<string, object> {
  const stats: Record<string, object> = {}
  for (const [name, breaker] of breakers.entries()) {
    stats[name] = breaker.stats
  }
  return stats
}
