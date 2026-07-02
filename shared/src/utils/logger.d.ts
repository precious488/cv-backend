import pino from 'pino';
export declare const logger: pino.Logger<never, boolean>;
export type Logger = typeof logger;
/** Create a child logger bound to a correlationId */
export declare function createCorrelatedLogger(correlationId: string): Logger;
