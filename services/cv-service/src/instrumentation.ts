import { initTelemetry } from '@craft/shared/dist/telemetry/instrumentation'
initTelemetry(process.env.SERVICE_NAME ?? 'cv-service')
