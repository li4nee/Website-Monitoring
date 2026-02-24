/**
 * This file defines custom error classes for handling various types of errors in the application.
 * Each error class extends the base CustomError class, which includes properties for status code, error code, and operational flag.
 * The error classes include InvalidInputError, PermissionNotGranted, ResourceNotFoundError, and InternalServerError, each with default messages and corresponding HTTP status codes.
 */

export enum ErrorMessage {
   INVALID_INPUT = "INVALID_INPUT",
   PERMISSION_NOT_GRANTED = "PERMISSION_NOT_GRANTED",
   RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
   INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
   RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
}

export enum ErrorHttpStatusCode {
   INVALID_INPUT = 400,
   PERMISSION_NOT_GRANTED = 403,
   RESOURCE_NOT_FOUND = 404,
   INTERNAL_SERVER_ERROR = 500,
   RATE_LIMIT_EXCEEDED = 429,
}

/**
 * Base class for custom errors in the application.
 * It extends the built-in Error class and includes additional properties
 * for status code, error code, and an operational flag to indicate if the error is expected or not.
 * @extends Error
 */
export class CustomError extends Error {
   public statusCode: number;
   public errorCode: ErrorMessage;
   public isOperational: boolean;

   constructor(message: string, statusCode: number, errorCode: ErrorMessage) {
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
      super(message, ErrorHttpStatusCode.INVALID_INPUT, ErrorMessage.INVALID_INPUT);
   }
}

/**
 * Error caused by lack of necessary permissions to access a resource or perform an action.
 * @extends CustomError
 */
export class PermissionNotGranted extends CustomError {
   constructor(message = "Permission not granted") {
      super(message, ErrorHttpStatusCode.PERMISSION_NOT_GRANTED, ErrorMessage.PERMISSION_NOT_GRANTED);
   }
}

/**
 * Error caused when a requested resource is not found in the system.
 * @extends CustomError
 */
export class ResourceNotFoundError extends CustomError {
   constructor(message = "Resource not found") {
      super(message, ErrorHttpStatusCode.RESOURCE_NOT_FOUND, ErrorMessage.RESOURCE_NOT_FOUND);
   }
}

/**
 * Error caused by exceeding the allowed number of requests in a given time frame.
 * @extends CustomError
 */
export class RateLimitExceededError extends CustomError {
   constructor(message = "Rate limit exceeded") {
      super(message, ErrorHttpStatusCode.RATE_LIMIT_EXCEEDED, ErrorMessage.RATE_LIMIT_EXCEEDED);
   }
}

/**
 * Error caused by an unexpected condition in the server that prevents it from fulfilling the request.
 * @extends CustomError
 */
export class InternalServerError extends CustomError {
   constructor(message = "Internal server error") {
      super(message, ErrorHttpStatusCode.INTERNAL_SERVER_ERROR, ErrorMessage.INTERNAL_SERVER_ERROR);
   }
}
