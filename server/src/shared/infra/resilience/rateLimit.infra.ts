import rateLimit from "express-rate-limit";
import { globalConfig } from "../../config/global.config";

export const rateLimiter = rateLimit({
   windowMs: globalConfig.rateLimit.windowMs,
   max: globalConfig.rateLimit.max,
   message: {
      success: false,
      message: "Too many requests, please try again later.",
      statusCode: 429,
   },
   // Ratelimit not X-Rate limit
   standardHeaders: true,
   legacyHeaders: false,
});

// For auth endpoints.
export const authRateLimiter = rateLimit({
   windowMs: globalConfig.rateLimit.auth.windowMs,
   max: globalConfig.rateLimit.auth.max,
   keyGenerator: (req) => {
      return req.body.email || req.ip;
   },
   message: {
      success: false,
      message: "Too many authentication attempts, please try again later.",
      statusCode: 429,
   },
   standardHeaders: true,
   legacyHeaders: false,
   // Only error count in attemts for rate limit.
   skipSuccessfulRequests: true,
});
