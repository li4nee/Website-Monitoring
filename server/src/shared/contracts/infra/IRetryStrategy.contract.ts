export interface IRetryStrategy {
   shouldRetry(attempt: number): boolean;
   getRetryDelay(attempt: number): number;
   waitForRetry(attempt: number): Promise<void>;
}