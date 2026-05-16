/**
 * This file defines custom error classes for handling various types of errors in the application.
 * Each error class extends the base CustomError class, which includes properties for status code, error code, and operational flag.
 * The error classes include InvalidInputError, PermissionNotGranted, ResourceNotFoundError, and InternalServerError, each with default messages and corresponding HTTP status codes.
 */

export enum ErrorCode {
   INVALID_INPUT = "INVALID_INPUT",
   VALIDATION_ERROR = "VALIDATION_ERROR",
   PERMISSION_NOT_GRANTED = "PERMISSION_NOT_GRANTED",
   RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
   INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
   RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
   RESOURCE_NOT_INITIALIZED = "RESOURCE_NOT_INITIALIZED",
   JSON_WEB_TOKEN_ERROR = "JSON_WEB_TOKEN_ERROR",
   UNAUTHORIZED = "UNAUTHORIZED",
   SHUTDOWN_IN_PROGRESS = "SHUTDOWN_IN_PROGRESS",
   CIRCUIT_BREAKER_OPEN = "CIRCUIT_BREAKER_OPEN",
   MAX_RETRIES_EXCEEDED = "MAX_RETRIES_EXCEEDED",
   MESSAGE_PUBLISH_FAILED = "MESSAGE_PUBLISH_FAILED",
   CORS_ERROR = "CORS_ERROR",
   ENVIRONMENT_VARIABLE_ERROR = "ENVIRONMENT_VARIABLE_ERROR",
   ALERT_EVALUATION_FAILED = "ALERT_EVALUATION_FAILED",
}

export enum ErrorHttpStatusCode {
   INVALID_INPUT = 400,
   PERMISSION_NOT_GRANTED = 403,
   RESOURCE_NOT_FOUND = 404,
   INTERNAL_SERVER_ERROR = 500,
   RATE_LIMIT_EXCEEDED = 429,
   RESOURCE_NOT_INITIALIZED = 500,
   JSON_WEB_TOKEN_ERROR = 401,
   UNAUTHORIZED = 401,
   SHUTDOWN_IN_PROGRESS = 503,
   CIRCUIT_BREAKER_OPEN = 503,
}

/**
 * Base class for custom errors in the application.
 * It extends the built-in Error class and includes additional properties
 * for status code, error code, and an operational flag to indicate if the error is expected or not.
 * @extends Error
 */
export class CustomError extends Error {
   public statusCode: number;
   public errorCode: ErrorCode;
   public isOperational: boolean;

   constructor(message: string, statusCode: number, errorCode: ErrorCode) {
      super(message);

      this.statusCode = statusCode;
      this.errorCode = errorCode;
      this.isOperational = true;

      Object.setPrototypeOf(this, new.target.prototype);
      Error.captureStackTrace(this);
   }
}

/**
 * Error caused by invalid input from the client.
 * @extends CustomError
 */
export class InvalidInputError extends CustomError {
   constructor(message = "Invalid input") {
      super(message, ErrorHttpStatusCode.INVALID_INPUT, ErrorCode.INVALID_INPUT);
   }
}

/**
 * Error caused by lack of necessary permissions to access a resource or perform an action.
 * @extends CustomError
 */
export class PermissionNotGranted extends CustomError {
   constructor(message = "Permission not granted") {
      super(message, ErrorHttpStatusCode.PERMISSION_NOT_GRANTED, ErrorCode.PERMISSION_NOT_GRANTED);
   }
}

/**
 * Error caused when a requested resource is not found in the system.
 * @extends CustomError
 */
export class ResourceNotFoundError extends CustomError {
   constructor(message = "Resource not found") {
      super(message, ErrorHttpStatusCode.RESOURCE_NOT_FOUND, ErrorCode.RESOURCE_NOT_FOUND);
   }
}

/**
 * Error caused by unauthorized access to a resource or action, typically due to missing or invalid authentication credentials.
 * @extends CustomError
 */
export class UnauthorizedError extends CustomError {
   constructor(message = "Unauthorized") {
      super(message, ErrorHttpStatusCode.UNAUTHORIZED, ErrorCode.UNAUTHORIZED);
   }
}

/**
 * Error caused by exceeding the allowed number of requests in a given time frame.
 * @extends CustomError
 */
export class RateLimitExceededError extends CustomError {
   constructor(message = "Rate limit exceeded") {
      super(message, ErrorHttpStatusCode.RATE_LIMIT_EXCEEDED, ErrorCode.RATE_LIMIT_EXCEEDED);
   }
}

/**
 * Error caused by an unexpected condition in the server that prevents it from fulfilling the request.
 * @extends CustomError
 */
export class InternalServerError extends CustomError {
   constructor(message = "Internal server error") {
      super(message, ErrorHttpStatusCode.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_SERVER_ERROR);
   }
}

/**
 * Error caused when a required resource or dependency is not properly initialized before use.
 * @extends CustomError
 */
export class ResourceNotInitializedError extends CustomError {
   constructor(message = "Resource not initialized") {
      super(message, ErrorHttpStatusCode.RESOURCE_NOT_INITIALIZED, ErrorCode.RESOURCE_NOT_INITIALIZED);
   }
}
/**
 * Error caused by issues related to JSON Web Tokens, such as invalid or expired tokens.
 * @extends CustomError
 */
export class JsonWebTokenError extends CustomError {
   constructor(message = "Invalid JSON Web Token") {
      super(message, ErrorHttpStatusCode.JSON_WEB_TOKEN_ERROR, ErrorCode.JSON_WEB_TOKEN_ERROR);
   }
}

export class EnvironmentVariableError extends CustomError {
   constructor(message = "Environment variable error") {
      super(message, ErrorHttpStatusCode.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_SERVER_ERROR);
   }
}

export class CORSError extends CustomError {
   constructor(message = "CORS error") {
      super(message, ErrorHttpStatusCode.PERMISSION_NOT_GRANTED, ErrorCode.CORS_ERROR);
   }
}

export class AlertEvaluationError extends CustomError {
   public readonly alertId: string;

   constructor(alertId: string, message = "Alert evaluation failed") {
      super(message, ErrorHttpStatusCode.INTERNAL_SERVER_ERROR, ErrorCode.ALERT_EVALUATION_FAILED);
      this.alertId = alertId;
   }
}