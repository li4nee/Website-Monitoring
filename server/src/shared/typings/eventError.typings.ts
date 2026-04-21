import { CustomError, ErrorCode, ErrorHttpStatusCode } from "./error.typings";

export class EventProducerError extends CustomError {
   constructor(message: string, errorCode: ErrorCode, statusCode = ErrorHttpStatusCode.INTERNAL_SERVER_ERROR) {
      super(message, statusCode, errorCode);
   }
}

export class ProducerShuttingDownError extends EventProducerError {
   constructor(message = "Producer is shutting down") {
      super(message, ErrorCode.SHUTDOWN_IN_PROGRESS, 503);
   }
}

export class CircuitBreakerOpenError extends EventProducerError {
   constructor(message = "Circuit breaker is open, publishing blocked") {
      super(message, ErrorCode.CIRCUIT_BREAKER_OPEN, ErrorHttpStatusCode.CIRCUIT_BREAKER_OPEN);
   }
}
