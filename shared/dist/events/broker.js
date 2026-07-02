"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initBroker = initBroker;
exports.publishEvent = publishEvent;
exports.subscribeToEvents = subscribeToEvents;
exports.closeBroker = closeBroker;
const amqplib_1 = __importDefault(require("amqplib"));
const logger_1 = require("../utils/logger");
const EXCHANGE = 'craft.events';
const RECONNECT_DELAY_MS = 5000;
let connection = null;
let publishChannel = null;
async function connect() {
    const url = process.env.RABBITMQ_URL;
    if (!url)
        throw new Error('RABBITMQ_URL env var is required');
    const conn = await amqplib_1.default.connect(url);
    conn.on('error', (err) => {
        logger_1.logger.error({ err }, 'RabbitMQ connection error');
    });
    conn.on('close', () => {
        logger_1.logger.warn('RabbitMQ connection closed — reconnecting');
        connection = null;
        publishChannel = null;
        setTimeout(initBroker, RECONNECT_DELAY_MS);
    });
    return conn;
}
async function initBroker() {
    try {
        connection = await connect();
        publishChannel = await connection.createChannel();
        await publishChannel.assertExchange(EXCHANGE, 'topic', { durable: true });
        logger_1.logger.info('RabbitMQ broker initialized');
    }
    catch (err) {
        logger_1.logger.error({ err }, 'Failed to init RabbitMQ — retrying');
        setTimeout(initBroker, RECONNECT_DELAY_MS);
    }
}
async function publishEvent(event) {
    if (!publishChannel) {
        logger_1.logger.warn('RabbitMQ publish channel not ready — event dropped');
        return;
    }
    const content = Buffer.from(JSON.stringify(event));
    publishChannel.publish(EXCHANGE, event.eventType, content, {
        persistent: true,
        contentType: 'application/json',
        headers: { correlationId: event.correlationId },
    });
    logger_1.logger.debug({ eventType: event.eventType, correlationId: event.correlationId }, 'Event published');
}
async function subscribeToEvents(queueName, bindingKeys, handler) {
    if (!connection)
        throw new Error('RabbitMQ not connected — call initBroker first');
    const channel = await connection.createChannel();
    await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
    const { queue } = await channel.assertQueue(queueName, {
        durable: true,
        arguments: { 'x-dead-letter-exchange': `${EXCHANGE}.dlx` },
    });
    for (const key of bindingKeys) {
        await channel.bindQueue(queue, EXCHANGE, key);
    }
    channel.prefetch(10);
    await channel.consume(queue, async (msg) => {
        if (!msg)
            return;
        try {
            const event = JSON.parse(msg.content.toString());
            await handler(event, msg);
            channel.ack(msg);
        }
        catch (err) {
            logger_1.logger.error({ err }, 'Event handler failed — nacking');
            channel.nack(msg, false, false);
        }
    });
    logger_1.logger.info({ queue, bindingKeys }, 'Subscribed to events');
}
async function closeBroker() {
    if (connection)
        await connection.close();
}
