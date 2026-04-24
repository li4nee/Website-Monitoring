import rateLimit from "express-rate-limit";import { globalConfig } from "../config/global.config";
;
export const rateLimiter = rateLimit({
   windowMs: globalConfig.rateLimit.windowMs,
   max: globalConfig.rateLimit.max,
   message: {
      success: false,
      message: "Too many requests, please try again later.",
      statusCode: 429,
   },
   standardHeaders: true,
   legacyHeaders: false,
});
