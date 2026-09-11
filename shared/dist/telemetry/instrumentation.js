"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initTelemetry = initTelemetry;
const sdk_node_1 = require("@opentelemetry/sdk-node");
const auto_instrumentations_node_1 = require("@opentelemetry/auto-instrumentations-node");
const exporter_trace_otlp_grpc_1 = require("@opentelemetry/exporter-trace-otlp-grpc");
const exporter_metrics_otlp_http_1 = require("@opentelemetry/exporter-metrics-otlp-http");
const sdk_metrics_1 = require("@opentelemetry/sdk-metrics");
const resources_1 = require("@opentelemetry/resources");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
function initTelemetry(serviceName) {
    const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://otel-collector:4317';
    const sdk = new sdk_node_1.NodeSDK({
        resource: (0, resources_1.resourceFromAttributes)({ [semantic_conventions_1.ATTR_SERVICE_NAME]: serviceName }),
        traceExporter: new exporter_trace_otlp_grpc_1.OTLPTraceExporter({ url: otlpEndpoint }),
        metricReader: new sdk_metrics_1.PeriodicExportingMetricReader({
            exporter: new exporter_metrics_otlp_http_1.OTLPMetricExporter({
                url: `${otlpEndpoint.replace('4317', '4318')}/v1/metrics`,
            }),
            exportIntervalMillis: 10000,
        }),
        instrumentations: [(0, auto_instrumentations_node_1.getNodeAutoInstrumentations)()],
    });
    sdk.start();
    process.on('SIGTERM', () => sdk.shutdown().finally(() => process.exit(0)));
    return sdk;
}
