import { RetryStrategyOptions } from "../typings/infra.typings";

export class RetryStrategy {
   private maxRetries: number;
   private baseRetryDelayInMs: number;
   private maxRetryDelayInMs: number;
   private jitterFactor: number;

   constructor(options: RetryStrategyOptions) {
      this.maxRetries = options.maxRetries ?? 3;
      this.baseRetryDelayInMs = options.baseRetryDelayInMs ?? 200;
      this.maxRetryDelayInMs = options.maxRetryDelayInMs ?? 5000;
      this.jitterFactor = options.jitterFactor ?? 0.25;
   }

   shouldRetry(attempt: number): boolean {
      return attempt < this.maxRetries;
   }

   /**
    * This need to solve the thundering herd problem.
    * Thundering herd problem is when you were getting 5 req/s and after downtime you sudeenly get 100 req/s and all of them retry at the same time and cause another downtime.
    * Delay = min(baseRetryDelay * 2^attempt, maxRetryDelay) * jitter
    * Jitter = JitterFactor * random(0, 1)
    * This delay is eexponential delay . Delay increases exponentially with each retry attempts.
    * Jitter is randomness in the delay. Helps to spread the retry attempts.
    *
    * Instead of 100 clients retry same time.
    * You get some at 100ms. Some at 200ms. Some at 400ms. And so on.
    * Now you don't retry to fast.But if you have 1000 clients and you retry just exponential delay without jitter. You will get 1000 clients retrying at 1s, 1000 clients retrying at 2s, 1000 clients retrying at 4s and so on. This can cause another downtime.
    * With jitter you will get some clients retrying at 1900ms, some at 1100ms and so on. This helps to spread the retry attempts and avoid thundering herd problem.
    */
   getRetryDelay(attempt: number): number {
      const exponentialDelay = this.baseRetryDelayInMs * Math.pow(2, attempt);
      const minimumDelay = Math.min(exponentialDelay, this.maxRetryDelayInMs);
      // Only positive jitter added.
      const jitter = 1 + Math.random() * this.jitterFactor;
      return minimumDelay * jitter;
   }

   waitForRetry(attempt: number): Promise<void> {
      const delay = this.getRetryDelay(attempt);
      return new Promise((resolve) => setTimeout(resolve, delay));
   }
}
