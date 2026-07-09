import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import { globalConfig } from "../../config/global.config";
import redisConnection from "../redisConnection";

const makeRedisStore = (prefix: string) =>
   new RedisStore({
      sendCommand: (command: string, ...args: string[]) => redisConnection.getClient().call(command, ...args) as Promise<RedisReply>,
      prefix,
   });

export const rateLimiter = rateLimit({
   windowMs: globalConfig.rateLimit.windowMs,
   max: globalConfig.rateLimit.max,
   store: makeRedisStore("rl:general:"),
   // Same fail-open stance as the idempotency store: if Redis is unreachable,
   // let the request through unlimited rather than 500ing every ingest hit.
   passOnStoreError: true,
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
   store: makeRedisStore("rl:auth:"),
   passOnStoreError: true,
   keyGenerator: (req) => {
      // A raw IPv6 address isn't a safe rate-limit key on its own — a single
      // user's ISP typically hands them an entire /64 subnet, so falling back
      // to req.ip directly would let them rotate addresses within it to bypass
      // the limit. ipKeyGenerator() normalizes to the /64 prefix instead.
      return req.body.email || ipKeyGenerator(req.ip || req.socket.remoteAddress || "unknown");
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
