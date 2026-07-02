import amqplib from 'amqplib';
import { BaseEvent, EventType } from '../types';
export declare function initBroker(): Promise<void>;
export declare function publishEvent<T>(event: BaseEvent<T>): Promise<void>;
export declare function subscribeToEvents(queueName: string, bindingKeys: EventType[], handler: (event: BaseEvent<unknown>, msg: amqplib.ConsumeMessage) => Promise<void>): Promise<void>;
export declare function closeBroker(): Promise<void>;
