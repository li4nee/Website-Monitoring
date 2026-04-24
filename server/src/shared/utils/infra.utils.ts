import { RETRYABLE_ERRORS, RetryableError } from "../typings/messaging.typings";

export function isRetryableError(error: RetryableError): boolean {
   if (!error) return false;

   if (error.code) {
      const errorCode = error.code.toUpperCase();
      return RETRYABLE_ERRORS.some((retryable) => errorCode.includes(retryable));
   }

   if (error.statusCode) {
      return error.statusCode >= 500;
   }

   return false;
}
