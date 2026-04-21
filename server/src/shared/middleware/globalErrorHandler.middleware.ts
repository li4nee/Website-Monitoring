import { Request, Response, NextFunction } from "express";
import { CustomError, ErrorCode } from "../typings/error.typings";
import { ResponseFormatter } from "../utils/responseFormatter.utils";
import logger from "../config/logger.config";
import { globalConfig } from "../config/global.config";

/**
 * GlobalErrorHandler is an Express middleware for handling errors across the application.
 * It also logs errors.
 */
export class GlobalErrorHandler {
   static handleError(err: any, req: Request, res: Response, _next: NextFunction) {
      const isProduction = globalConfig.node_env === "production";
      const logContext = {
         message: err.message,
         stack: err.stack,
         path: req.path,
         method: req.method,
      };

      if (err instanceof CustomError) {
         logger.error("[GlobalErrorHandler] Operational error", {
            ...logContext,
            errorCode: err.errorCode,
         });

         return res
            .status(err.statusCode)
            .json(ResponseFormatter.error(err.message, err.statusCode, isProduction ? null : err, err.errorCode));
      }

      // Mainly postgres errors
      if (err.code === "23505") {
         logger.warn("[GlobalErrorHandler] Database unique constraint violation", logContext);

         return res
            .status(409)
            .json(ResponseFormatter.error("Duplicate resource", 409, isProduction ? null : err, ErrorCode.INVALID_INPUT));
      }

      if (err.code === "23503") {
         logger.warn("[GlobalErrorHandler] Database foreign key violation", logContext);

         return res
            .status(400)
            .json(ResponseFormatter.error("Invalid reference", 400, isProduction ? null : err, ErrorCode.INVALID_INPUT));
      }

      // Mongoose Validation Errors
      if (err.name === "ValidationError") {
         logger.warn("[GlobalErrorHandler] Validation error", logContext);

         return res
            .status(400)
            .json(ResponseFormatter.error("Validation Error", 400, isProduction ? null : err, ErrorCode.VALIDATION_ERROR));
      }

      // JWT Errors
      if (err.name === "TokenExpiredError") {
         logger.warn("[GlobalErrorHandler] Token expired", logContext);

         return res
            .status(401)
            .json(
               ResponseFormatter.error(
                  "Authentication Error: Token Expired",
                  401,
                  isProduction ? null : err,
                  ErrorCode.PERMISSION_NOT_GRANTED,
               ),
            );
      }

      if (err.name === "JsonWebTokenError") {
         logger.warn("[GlobalErrorHandler] Invalid JWT token", logContext);

         return res
            .status(401)
            .json(
               ResponseFormatter.error(
                  "Authentication Error: Invalid Token",
                  401,
                  isProduction ? null : err,
                  ErrorCode.PERMISSION_NOT_GRANTED,
               ),
            );
      }

      // unexpected errors
      logger.error("[GlobalErrorHandler] Unexpected error", logContext);

      return res
         .status(500)
         .json(ResponseFormatter.error("Internal Server Error", 500, isProduction ? null : err, ErrorCode.INTERNAL_SERVER_ERROR));
   }
}
