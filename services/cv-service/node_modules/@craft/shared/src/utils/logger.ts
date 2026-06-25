import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: isDev
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
    : undefined,
  base: {
    service: process.env.SERVICE_NAME ?? 'unknown-service',
    env: process.env.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  redact: {
    paths: ['req.headers.authorization', 'password', 'refreshToken', '*.password'],
    censor: '[REDACTED]',
  },
});

export type Logger = typeof logger;

/** Create a child logger bound to a correlationId */
export function createCorrelatedLogger(correlationId: string): Logger {
  return logger.child({ correlationId }) as unknown as Logger;
}
