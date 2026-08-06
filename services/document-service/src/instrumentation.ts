import { initTelemetry } from '@craft/shared/src/telemetry/instrumentation'
initTelemetry(process.env.SERVICE_NAME ?? 'document-service')
