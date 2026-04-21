export enum CircuitBreakerState {
   CLOSED = "CLOSED", // normal
   OPEN = "OPEN", // closed
   HALF_OPEN = "HALF_OPEN", // testing if we can open
}

export interface CircuitBreakerOptions {
   failureThreshold: number; // Number of failures before opening the circuit
   cooldownTimeInMs: number; // Time to wait before transitioning from OPEN to HALF_OPEN
   halfOpenStateMaxAttempts: number; // Number of attempts allowed in HALF_OPEN state before transitioning back to OPEN
}

/**
 * List of errors that are considered retryable for circuit breaker.
 */
export const RETRYABLE_ERRORS = [
   "ECONNREFUSED", // Connection refused by the server
   "ETIMEDOUT", // Connection timed out
   "ECONNRESET", // Connection reset by the server
   "CHANNEL_CLOSED", // Channel closed unexpectedly
   "CONNEECTION_CLOSED", // Connection closed unexpectedly
   "SERVER_ERROR", // Generic server error
   "NETWORK_ERROR", // Generic network error
   "BUFFER_FULL", // Buffer full error
];

export type RetryableError = Error & {
   code?: string;
   statusCode?: number;
};

export interface RetryStrategyOptions {
   maxRetries?: number; // Maximum number of retry attempts
   baseRetryDelayInMs?: number; // Initial delay between retries in milliseconds
   maxRetryDelayInMs?: number; // Maximum delay between retries in milliseconds
   jitterFactor?: number; // Factor to add randomness to retry delays (0 to 1)
}

export enum EventType {
   API_HITS = "API_HITS",
}

export interface EventProducerMetricsType {
   published: number;
   failed: number;
   retriesUsed: number;
}


// messageId = unique ID of one single text message
// correlationId = chat ID of the whole conversation
export interface PublishingEventDataType {
   eventData: any;
   messageId: string; 
   correlationId: string; 
   attempts?: number;
}

export interface PublishingMessageType {
   type: EventType;
   data: PublishingEventDataType;
   publishedAt: String;
}

export interface PublishOptions {
   persistent: boolean; // Whether the message should be marked as persistent
   contentType: string; // Content type of the message
   messageId: string; // Unique identifier for the message
   correlationId: string; // Correlation ID for tracking related messages
   timestamp: number; // Timestamp of when the message was published , but in seconds not in ms
}
