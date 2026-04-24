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
