import amqplib from 'amqplib';
import { logger } from '../utils/logger';
import { BaseEvent, EventType } from '../types';

const EXCHANGE = 'craft.events';
const RECONNECT_DELAY_MS = 5000;

// amqplib v0.10+ returns ChannelModel from connect()
type AmqpConnection = Awaited<ReturnType<typeof amqplib.connect>>;
type AmqpChannel = Awaited<ReturnType<AmqpConnection['createChannel']>>;

let connection: AmqpConnection | null = null;
let publishChannel: AmqpChannel | null = null;

async function connect(): Promise<AmqpConnection> {
  const url = process.env.RABBITMQ_URL;
  if (!url) throw new Error('RABBITMQ_URL env var is required');
  const conn = await amqplib.connect(url);
  conn.on('error', (err: Error) => {
    logger.error({ err }, 'RabbitMQ connection error');
  });
  conn.on('close', () => {
    logger.warn('RabbitMQ connection closed — reconnecting');
    connection = null;
    publishChannel = null;
    setTimeout(initBroker, RECONNECT_DELAY_MS);
  });
  return conn;
}

export async function initBroker(): Promise<void> {
  try {
    connection = await connect();
    publishChannel = await connection.createChannel();
    await publishChannel.assertExchange(EXCHANGE, 'topic', { durable: true });
    logger.info('RabbitMQ broker initialized');
  } catch (err) {
    logger.error({ err }, 'Failed to init RabbitMQ — retrying');
    setTimeout(initBroker, RECONNECT_DELAY_MS);
  }
}

export async function publishEvent<T>(event: BaseEvent<T>): Promise<void> {
  if (!publishChannel) {
    logger.warn('RabbitMQ publish channel not ready — event dropped');
    return;
  }
  const content = Buffer.from(JSON.stringify(event));
  publishChannel.publish(EXCHANGE, event.eventType, content, {
    persistent: true,
    contentType: 'application/json',
    headers: { correlationId: event.correlationId },
  });
  logger.debug({ eventType: event.eventType, correlationId: event.correlationId }, 'Event published');
}

export async function subscribeToEvents(
  queueName: string,
  bindingKeys: EventType[],
  handler: (event: BaseEvent<unknown>, msg: amqplib.ConsumeMessage) => Promise<void>
): Promise<void> {
  if (!connection) throw new Error('RabbitMQ not connected — call initBroker first');

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

  await channel.consume(queue, async (msg: amqplib.ConsumeMessage | null) => {
    if (!msg) return;
    try {
      const event = JSON.parse(msg.content.toString()) as BaseEvent<unknown>;
      await handler(event, msg);
      channel.ack(msg);
    } catch (err) {
      logger.error({ err }, 'Event handler failed — nacking');
      channel.nack(msg, false, false);
    }
  });

  logger.info({ queue, bindingKeys }, 'Subscribed to events');
}

export async function closeBroker(): Promise<void> {
  if (connection) await connection.close();
}
