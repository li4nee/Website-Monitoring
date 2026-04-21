import logger from "../config/logger.config";
import { CircuitBreakerOptions, CircuitBreakerState } from "../typings/infra.typings";

export class CircuitBreaker {
   private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
   private cooldownTimeInMs: number;
   private failureThreshold: number;
   private failureCount: number = 0;
   private lastFailureTime: number = 0;
   private halfOpenStateMaxAttempts: number;
   private halfOpenStateAttempts: number = 0;
   private halfOpenSuccessCount: number = 0;

   constructor(options: CircuitBreakerOptions) {
      this.failureThreshold = options.failureThreshold;
      this.cooldownTimeInMs = options.cooldownTimeInMs;
      this.halfOpenStateMaxAttempts = options.halfOpenStateMaxAttempts;
   }

   /**
    * Checks if the cooldown time has passed the threshhold to go to half open state.
    */
   private cooldownTimePassed(): boolean {
      return Date.now() - this.lastFailureTime >= this.cooldownTimeInMs;
   }

   /**
    * Used to transition from one to another state with logging.
    */
   private transitionStateTo(newState: CircuitBreakerState): void {
      const previousState = this.state;
      this.state = newState;

      logger.info(`Circuit breaker state transitioned from ${previousState} to ${newState}`);
   }

   /**
    * Sets the last failure time to current timestamp. Used when a failure happens or when the circuit is opened.
    */
   private setLastFailureTime(timestamp: number): void {
      this.lastFailureTime = timestamp;
   }

   /**
    * Opens the circuit breaker, transitions to OPEN state, sets the last failure time, and resets the failure count and half-open attempts.
    */
   openCircuit(): void {
      this.transitionStateTo(CircuitBreakerState.OPEN);
      this.setLastFailureTime(Date.now());
      this.failureCount = 0;
      this.halfOpenStateAttempts = 0;
      this.halfOpenSuccessCount = 0;

      logger.info(`Circuit breaker opened. Cooldown time: ${this.cooldownTimeInMs} ms.`);
   }

   /**
    * Closes the circuit breaker, transitions to CLOSED state, and resets all relevant counters and timestamps.
    */
   closeCircuit(): void {
      this.transitionStateTo(CircuitBreakerState.CLOSED);

      logger.info(
         `Circuit breaker closed. Attempts in half-open: ${this.halfOpenStateAttempts}, Successes: ${this.halfOpenSuccessCount}`,
      );

      this.failureCount = 0;
      this.halfOpenStateAttempts = 0;
      this.halfOpenSuccessCount = 0;
   }

   private moveToHalfOpenIfReady(): void {
      if (this.state === CircuitBreakerState.OPEN && this.cooldownTimePassed()) {
         this.transitionStateTo(CircuitBreakerState.HALF_OPEN);
      }
   }

   /**
    * Returns the current state of the circuit breaker. If the circuit is OPEN and the cooldown time has passed, it transitions to HALF_OPEN before returning the state.
    */
   get currentState(): CircuitBreakerState {
      this.moveToHalfOpenIfReady();
      return this.state;
   }

   /**
    * Returms true is sending request is allowed rn.
    */
   isRequestAllowed(): boolean {
      this.moveToHalfOpenIfReady();

      if (this.state === CircuitBreakerState.CLOSED) {
         return true;
      }

      if (this.state === CircuitBreakerState.HALF_OPEN) {
         if (this.halfOpenStateAttempts < this.halfOpenStateMaxAttempts) {
            this.halfOpenStateAttempts++;
            return true;
         }
         return false;
      }

      return false;
   }

   onSuccess(): void {
      if (this.state === CircuitBreakerState.HALF_OPEN) {
         this.halfOpenSuccessCount++;

         // If halfopen success count crosses the max attempts then close the circuit.
         // It means aaba healthy cha service
         if (this.halfOpenSuccessCount >= this.halfOpenStateMaxAttempts) {
            this.closeCircuit();
         }
      }
   }

   onFailure(): void {
      // In HALF_OPEN if one error then open the circuit.
      if (this.state === CircuitBreakerState.HALF_OPEN) {
         this.openCircuit();
         return;
      }

      this.failureCount++;
      this.setLastFailureTime(Date.now());

      if (this.failureCount >= this.failureThreshold) {
         this.openCircuit();
      }
   }

   get Stats() {
      return {
         state: this.state,
         failureCount: this.failureCount,
         lastFailureTime: this.lastFailureTime,
         timeSinceLastFailure: Date.now() - this.lastFailureTime,
         halfOpenStateAttempts: this.halfOpenStateAttempts,
         halfOpenRemainingAttempts: this.halfOpenStateMaxAttempts - this.halfOpenStateAttempts,
         halfOpenSuccessCount: this.halfOpenSuccessCount,
         failureThreshold: this.failureThreshold,
         failureRateCurrent: (this.failureCount / (this.halfOpenStateAttempts || 1)) * 100,
      };
   }
}
