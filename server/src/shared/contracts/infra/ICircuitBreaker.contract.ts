import { CircuitBreakerState, CircuitBreakerStatsType } from "../../typings/circuitBreaker.typings";

export interface ICircuitBreaker {
   isRequestAllowed(): boolean;
   onSuccess(): void;
   onFailure(): void;
   getStats(): CircuitBreakerStatsType;
   getCurrentState(): CircuitBreakerState;
}
