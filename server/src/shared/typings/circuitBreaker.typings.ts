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

export type CircuitBreakerStatsType = {
   state: CircuitBreakerState;
   failureCount: number;
   lastFailureTime: number;
   timeSinceLastFailure: number;
   halfOpenStateAttempts: number;
   halfOpenRemainingAttempts: number;
   halfOpenSuccessCount: number;
   failureThreshold: number;
   failureRateCurrent: number;
};