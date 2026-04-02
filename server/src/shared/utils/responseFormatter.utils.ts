import { CustomError, ErrorCode } from "../typings/error.typings";

/**
 * ApiResponse defines the standard structure for API responses.
 */
export interface ApiResponse {
   success: boolean;
   statusCode: number;
   message: string;
   data?: any;
   errorCode?: ErrorCode | null;
   timestamp: string;
   error?: any;
}

/**
 * PaginatedResponse extends ApiResponse to include pagination details for paginated endpoints.
 */
export interface PaginatedResponse extends ApiResponse {
   pagination: {
      total: number;
      page: number;
      limit: number;
      pages: number;
   };
}
/**
 * ResponseFormatter is a utility class for standardizing API responses.
 */
export class ResponseFormatter {
   private static formatResponse(
      success: boolean = true,
      statusCode: number = 200,
      message: string = "Success",
      data?: any,
      error?: any,
      errorCode?: ErrorCode,
   ): ApiResponse {
      return {
         success,
         statusCode,
         message,
         data: data || null,
         errorCode: errorCode || null,
         error: error || null,
         timestamp: new Date().toISOString(),
      };
   }

   /**
    *
    * @param message
    * @param statusCode
    * @param data
    * @returns {ApiResponse} Success Response in standard form.
    */
   static success(message: string, statusCode: number = 200, data?: any): ApiResponse {
      return this.formatResponse(true, statusCode, message, data);
   }

   /**
    *
    * @param message
    * @param statusCode
    * @param error
    * @returns {ApiResponse} Error Response in standard form.
    */
   static error(message: string, statusCode: number = 500, error?: CustomError | any, errorCode?: ErrorCode): ApiResponse {
      return this.formatResponse(false, statusCode, message, null, error, errorCode);
   }

   /**
    *
    * @param total
    * @param page
    * @param limit
    * @param message
    * @param data
    * @returns {PaginatedResponse} Pagibated Response in standard form with pagination details.
    */
   static paginated(total: number, page: number, limit: number, message: string = "Success", data: any[]): PaginatedResponse {
      return {
         success: true,
         statusCode: 200,
         message,
         data,
         pagination: { total, page, limit, pages: Math.ceil(total / limit) },
         timestamp: new Date().toISOString(),
      };
   }
}
