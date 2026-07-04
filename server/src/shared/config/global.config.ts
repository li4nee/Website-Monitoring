import dotenv from "dotenv";
import { z } from "zod";
import { StringValue } from "ms";
import { EnvironmentVariableError } from "../typings/error.typings";
dotenv.config();

const isProduction = process.env.NODE_ENV === "production";

// Secrets that MUST be a real value in production — in any other environment
// they fall back to an insecure-but-convenient dev default (applied below,
// after validation, not part of this schema).
const PRODUCTION_REQUIRED_SECRETS = ["JWT_SECRET", "POSTGRES_PASSWORD", "API_KEY_HMAC_SECRET"] as const;

// Every raw env var is a string or absent — numeric/boolean fields are kept as
// `.optional()` strings here and only format-checked, so a malformed value
// (e.g. RATE_LIMIT_MAX=oops) fails loudly at boot instead of silently becoming
// NaN deep inside express-rate-limit. Actual parsing/defaulting happens once,
// below, building `globalConfig` from this already-validated env.
const numeric = z
   .string()
   .regex(/^-?\d+(\.\d+)?$/, "must be a number")
   .optional();
const booleanish = z.enum(["true", "false"]).optional();

const envSchema = z.object({
   NODE_ENV: z.string().optional(),
   PORT: numeric,
   VERSION: z.string().optional(),

   JWT_SECRET: z.string().optional(),
   JWT_EXPIRES_IN: z.string().optional(),

   RATE_LIMIT_WINDOW_MS: numeric,
   RATE_LIMIT_MAX: numeric,
   RATE_LIMIT_PROTECTED_MAX: numeric,
   AUTH_RATE_LIMIT_WINDOW_MS: numeric,
   AUTH_RATE_LIMIT_MAX: numeric,

   MONGO_URL: z.string().optional(),
   MONGO_DB_NAME: z.string().optional(),

   POSTGRES_HOST: z.string().optional(),
   POSTGRES_PORT: numeric,
   POSTGRES_USER: z.string().optional(),
   POSTGRES_PASSWORD: z.string().optional(),
   POSTGRES_DB: z.string().optional(),
   POSTGRES_MAX_POOL_SIZE: numeric,
   POSTGRES_IDLE_TIMEOUT_MS: numeric,
   POSTGRES_CONNECTION_TIMEOUT_MS: numeric,

   REDIS_URL: z.string().optional(),

   RABBITMQ_URL: z.string().optional(),
   RABBITMQ_QUEUE: z.string().optional(),
   RABBITMQ_EXCHANGE: z.string().optional(),
   RABBITMQ_PUBLISHER_CONFIRM: booleanish,

   CIRCUIT_BREAKER_FAILURE_THRESHOLD: numeric,
   CIRCUIT_BREAKER_COOLDOWN_TIME_IN_MS: numeric,
   CIRCUIT_BREAKER_HALF_OPEN_STATE_MAX_ATTEMPTS: numeric,
   RABBITMQ_RETRY_ATTEMPTS: numeric,
   RABBITMQ_RETRY_DELAY: numeric,
   RABBITMQ_MAX_RETRY_DELAY: numeric,
   RABBITMQ_JITTER_FACTOR: numeric,

   MONGO_POSTGRES_MAX_RETRY_ATTEMPTS_IN_CONSUMER: numeric,
   CONSUMER_PREFETCH_COUNT: numeric,
   CONSUMER_POSTGRES_METRIC_UPSERT_RETRY_ATTEMPTS: numeric,
   CONSUMER_IDEMPOTENCY_TTL_SECONDS: numeric,
   CONSUMER_FAILURE_THRESHOLD_FOR_EVENT_TYPE: numeric,

   EVENT_CONSUMER_STARTUP_RETRY_STRATEGY_MAX_RETRIES: numeric,
   EVENT_CONSUMER_STARTUP_RETRY_STRATEGY_BASE_RETRY_DELAY_IN_MS: numeric,
   EVENT_CONSUMER_STARTUP_RETRY_STRATEGY_MAX_RETRY_DELAY_IN_MS: numeric,
   EVENT_CONSUMER_STARTUP_RETRY_STRATEGY_JITTER_FACTOR: numeric,

   ALERTING_WORKER_POLL_INTERVAL_MS: numeric,
   ALERTING_WORKER_DB_MAX_RETRY_ATTEMPTS: numeric,
   ALERTING_WORKER_STARTUP_MAX_RETRIES: numeric,
   ALERTING_WORKER_STARTUP_BASE_RETRY_DELAY_MS: numeric,
   ALERTING_WORKER_STARTUP_MAX_RETRY_DELAY_MS: numeric,
   ALERTING_WORKER_STARTUP_JITTER_FACTOR: numeric,

   COOKIE_MAX_AGE: numeric,

   CORS_ALLOWED_ORIGINS: z.string().optional(),

   API_KEY_HMAC_SECRET: z.string().optional(),

   SMTP_HOST: z.string().optional(),
   SMTP_PORT: numeric,
   SMTP_SECURE: booleanish,
   SMTP_USER: z.string().optional(),
   SMTP_PASS: z.string().optional(),
   SMTP_DEFAULT_FROM: z.string().optional(),
});

const envSchemaWithProdChecks = envSchema.superRefine((data, ctx) => {
   if (data.NODE_ENV !== "production") return;

   for (const key of PRODUCTION_REQUIRED_SECRETS) {
      if (!data[key]) {
         ctx.addIssue({
            code: "custom",
            path: [key],
            message: `${key} is required in production (no insecure dev fallback is used outside development)`,
         });
      }
   }
});

const parsedEnv = envSchemaWithProdChecks.safeParse(process.env);

if (!parsedEnv.success) {
   const issues = parsedEnv.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
   throw new EnvironmentVariableError(`Invalid environment configuration:\n${issues}`);
}

const env = parsedEnv.data;

/**
 * Global configuration object that holds all the necessary configuration values for the application.
 */
export const globalConfig = {
   node_env: env.NODE_ENV || "development",
   port: parseInt(env.PORT || "4000", 10),
   version: env.VERSION || "1.0.0",

   // JWT
   jwt: {
      secret: env.JWT_SECRET || (isProduction ? "" : "change-me-babby"),
      expiresIn: (env.JWT_EXPIRES_IN || "12h") as StringValue,
   },

   // rateLimit
   rateLimit: {
      windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS || "60000", 10),
      max: parseInt(env.RATE_LIMIT_MAX || "15", 10),
      protectedMax: parseInt(env.RATE_LIMIT_PROTECTED_MAX || "30", 10),
      // For auth endpoints, stricter rate limit
      auth: {
         windowMs: parseInt(env.AUTH_RATE_LIMIT_WINDOW_MS || `${15 * 60 * 1000}`, 10),
         max: parseInt(env.AUTH_RATE_LIMIT_MAX || "5", 10),
      },
   },

   //mongodb
   mongo: {
      url: env.MONGO_URL || "mongodb://localhost:27017/server_monitoring",
      dbName: env.MONGO_DB_NAME || "myapp",
   },

   //postgresql

   postgres: {
      host: env.POSTGRES_HOST || "postgres",
      port: parseInt(env.POSTGRES_PORT || "5432", 10),
      user: env.POSTGRES_USER || "postgres",
      password: env.POSTGRES_PASSWORD || (isProduction ? "" : "dev-only-insecure-postgres-password"),
      database: env.POSTGRES_DB || "server_monitoring",
      maxPoolSize: parseInt(env.POSTGRES_MAX_POOL_SIZE || "10", 10),
      idleTimeoutMillis: parseInt(env.POSTGRES_IDLE_TIMEOUT_MS || "30000", 10), // 30 seconds
      connectionTimeoutMillis: parseInt(env.POSTGRES_CONNECTION_TIMEOUT_MS || "2000", 10), // 2 seconds
   },

   //redis
   redis: {
      url: env.REDIS_URL || "redis://localhost:6379",
   },

   //rabbitmq
   amqp: {
      url: env.RABBITMQ_URL || "amqp://localhost:5672",
      queue: env.RABBITMQ_QUEUE || "server_monitoring_queue",
      exchange: env.RABBITMQ_EXCHANGE || "server_monitoring_exchange",
      publisherConfirm: env.RABBITMQ_PUBLISHER_CONFIRM === "true", // confirms need garne ki nagarne pako
   },

   infra: {
      circuitBreakerFailureThreshold: parseInt(env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || "5", 10),
      circuitBreakerCooldownTimeInMs: parseInt(env.CIRCUIT_BREAKER_COOLDOWN_TIME_IN_MS || "30000", 10), // 30 seconds
      circuitBreakerHalfOpenStateMaxAttempts: parseInt(env.CIRCUIT_BREAKER_HALF_OPEN_STATE_MAX_ATTEMPTS || "2", 10),
      retryAttempts: parseInt(env.RABBITMQ_RETRY_ATTEMPTS || "5", 10),
      retryDelay: parseInt(env.RABBITMQ_RETRY_DELAY || "1000", 10), // ms ma ho yo base retry delay.
      maxRetryDelay: parseInt(env.RABBITMQ_MAX_RETRY_DELAY || "30000", 10), // ms ma ho yo max retry delay.
      jitterFactor: parseFloat(env.RABBITMQ_JITTER_FACTOR || "0.3"), // 0.3 means add up to 30% random jitter to avoid thundering herd problem
   },

   consumer: {
      mongoPostgresConnectionMaxRetryAttemptsInConsumer: parseInt(
         env.MONGO_POSTGRES_MAX_RETRY_ATTEMPTS_IN_CONSUMER || "5",
         10,
      ),
      // How many message one consumer instance can process before acknoledging them.
      prefetchCount: parseInt(env.CONSUMER_PREFETCH_COUNT || "20", 10),
      // We don't mind if postgres upsert will fail sometimes since we have raw logs in MongoDb and then can calculate
      // But if we want to retry then how many times we want to retry.
      postGresMetricUpsertRetryAttempts: parseInt(env.CONSUMER_POSTGRES_METRIC_UPSERT_RETRY_ATTEMPTS || "2", 10),

      // Idempotency: how long a processed messageId is remembered in Redis before
      // it's allowed to expire (shared across all consumer instances, so scaling
      // out horizontally doesn't reintroduce duplicate processing).
      idempotencyTtlSeconds: parseInt(env.CONSUMER_IDEMPOTENCY_TTL_SECONDS || "3600", 10),

      // To find the poison event type causing continuous failure in consumer.
      failureThresholdForEventTypeInConsumer: parseInt(env.CONSUMER_FAILURE_THRESHOLD_FOR_EVENT_TYPE || "10", 10),

      eventConsumerStrategyRetryStrategyOptions: {
         maxRetries: parseInt(env.EVENT_CONSUMER_STARTUP_RETRY_STRATEGY_MAX_RETRIES || "5", 10),
         baseRetryDelayInMs: parseInt(env.EVENT_CONSUMER_STARTUP_RETRY_STRATEGY_BASE_RETRY_DELAY_IN_MS || "1000", 10), // 1 second
         maxRetryDelayInMs: parseInt(env.EVENT_CONSUMER_STARTUP_RETRY_STRATEGY_MAX_RETRY_DELAY_IN_MS || "30000", 10), // 30 seconds
         jitterFactor: parseFloat(env.EVENT_CONSUMER_STARTUP_RETRY_STRATEGY_JITTER_FACTOR || "0.3"), // 0.3 means add up to 30% random jitter to avoid thundering herd problem
      },
   },

   alertingWorker: {
      pollIntervalMs: parseInt(env.ALERTING_WORKER_POLL_INTERVAL_MS || "60000", 10), // 1 minute
      mongoPostgresConnectionMaxRetryAttempts: parseInt(env.ALERTING_WORKER_DB_MAX_RETRY_ATTEMPTS || "5", 10),
      startupRetryStrategyOptions: {
         maxRetries: parseInt(env.ALERTING_WORKER_STARTUP_MAX_RETRIES || "5", 10),
         baseRetryDelayInMs: parseInt(env.ALERTING_WORKER_STARTUP_BASE_RETRY_DELAY_MS || "1000", 10),
         maxRetryDelayInMs: parseInt(env.ALERTING_WORKER_STARTUP_MAX_RETRY_DELAY_MS || "30000", 10),
         jitterFactor: parseFloat(env.ALERTING_WORKER_STARTUP_JITTER_FACTOR || "0.3"),
      },
   },

   cookieOptions: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax" as const,
      maxAge: parseInt(env.COOKIE_MAX_AGE || `${8 * 60 * 60 * 1000}`, 10),
   },

   cors: {
      allowedOrigins: env.CORS_ALLOWED_ORIGINS
         ? env.CORS_ALLOWED_ORIGINS.split(",").map((o) => o.trim())
         : ["http://localhost:3000"],
   },

   apiKey: {
      hmacSecret: env.API_KEY_HMAC_SECRET || (isProduction ? "" : "dev-only-insecure-apikey-hmac-secret"),
   },

   email: {
      host: env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(env.SMTP_PORT || "587", 10),
      secure: env.SMTP_SECURE === "true",
      user: env.SMTP_USER || "",
      pass: env.SMTP_PASS || "",
      defaultFrom: env.SMTP_DEFAULT_FROM || "alerts@servermonitoring.local",
   },
};
