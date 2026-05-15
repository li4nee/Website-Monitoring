import dotenv from "dotenv";
import { StringValue } from "ms";
import { EnvironmentVariableError } from "../typings/error.typings";
dotenv.config();

const isProduction = process.env.NODE_ENV === "production";
function requireSecret(envVar: string, fallback?: string): string {
   const value = process.env[envVar];
   if (!value) {
      if (isProduction) throw new EnvironmentVariableError(`Missing required environment variable: ${envVar}`);
      if (fallback === undefined) throw new EnvironmentVariableError(`Missing required environment variable: ${envVar}`);
      return fallback;
   }
   return value;
}

/**
 * Global configuration object that holds all the necessary configuration values for the application.
 */
export const globalConfig = {
   node_env: process.env.NODE_ENV || "development",
   port: parseInt(process.env.PORT || "4000", 10),
   version: process.env.VERSION || "1.0.0",

   // JWT
   jwt: {
      secret: requireSecret("JWT_SECRET", "change-me-babby"),
      expiresIn: (process.env.JWT_EXPIRES_IN || "12h") as StringValue,
   },

   // rateLimit
   rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10),
      max: parseInt(process.env.RATE_LIMIT_MAX || "15", 10),
      protectedMax: parseInt(process.env.RATE_LIMIT_PROTECTED_MAX || "30", 10),
      // For auth endpoints, stricter rate limit
      auth: {
         windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || `${15 * 60 * 1000}`, 10),
         max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || "5", 10),
      },
   },

   //mongodb
   mongo: {
      url: process.env.MONGO_URL || "mongodb://localhost:27017/server_monitoring",
      dbName: process.env.MONGO_DB_NAME || "myapp",
   },

   //postgresql

   postgres: {
      host: process.env.POSTGRES_HOST || "postgres",
      port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
      user: process.env.POSTGRES_USER || "postgres",
      password: requireSecret("POSTGRES_PASSWORD", "dev-only-insecure-postgres-password"),
      database: process.env.POSTGRES_DB || "server_monitoring",
      maxPoolSize: parseInt(process.env.POSTGRES_MAX_POOL_SIZE || "10", 10),
      idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT_MS || "30000", 10), // 30 seconds
      connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT_MS || "2000", 10), // 2 seconds
   },

   //rabbitmq
   amqp: {
      url: process.env.RABBITMQ_URL || "amqp://localhost:5672",
      queue: process.env.RABBITMQ_QUEUE || "server_monitoring_queue",
      exchange: process.env.RABBITMQ_EXCHANGE || "server_monitoring_exchange",
      publisherConfirm: process.env.RABBITMQ_PUBLISHER_CONFIRM === "true" || false, // confirms need garne ki nagarne pako
   },

   infra: {
      circuitBreakerFailureThreshold: parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || "5", 10),
      circuitBreakerCooldownTimeInMs: parseInt(process.env.CIRCUIT_BREAKER_COOLDOWN_TIME_IN_MS || "30000", 10), // 30 seconds
      circuitBreakerHalfOpenStateMaxAttempts: parseInt(process.env.CIRCUIT_BREAKER_HALF_OPEN_STATE_MAX_ATTEMPTS || "2", 10),
      retryAttempts: parseInt(process.env.RABBITMQ_RETRY_ATTEMPTS || "5", 10),
      retryDelay: parseInt(process.env.RABBITMQ_RETRY_DELAY || "1000", 10), // ms ma ho yo base retry delay.
      maxRetryDelay: parseInt(process.env.RABBITMQ_MAX_RETRY_DELAY || "30000", 10), // ms ma ho yo max retry delay.
      jitterFactor: parseFloat(process.env.RABBITMQ_JITTER_FACTOR || "0.3"), // 0.3 means add up to 30% random jitter to avoid thundering herd problem
   },

   consumer: {
      mongoPostgresConnectionMaxRetryAttemptsInConsumer: parseInt(
         process.env.MONGO_POSTGRES_MAX_RETRY_ATTEMPTS_IN_CONSUMER || "5",
         10,
      ),
      // How many message one consumer instance can process before acknoledging them.
      prefetchCount: parseInt(process.env.CONSUMER_PREFETCH_COUNT || "20", 10),
      // We don't mind if postgres upsert will fail sometimes since we have raw logs in MongoDb and then can calculate
      // But if we want to retry then how many times we want to retry.
      postGresMetricUpsertRetryAttempts: parseInt(process.env.CONSUMER_POSTGRES_METRIC_UPSERT_RETRY_ATTEMPTS || "2", 10),

      // To prevent memory leak we will keep track of processed event IDs in memory and if the same event ID comes again we will ignore it.
      // This is for idempotency
      maxProcessedEventIdsCacheSize: parseInt(process.env.CONSUMER_MAX_PROCESSED_EVENT_IDS_CACHE_SIZE || "10000", 10),

      // To find the poison event type causing continuous failure in consumer.
      failureThresholdForEventTypeInConsumer: parseInt(process.env.CONSUMER_FAILURE_THRESHOLD_FOR_EVENT_TYPE || "10", 10),

      eventConsumerStrategyRetryStrategyOptions: {
         maxRetries: parseInt(process.env.EVENT_CONSUMER_STARTUP_RETRY_STRATEGY_MAX_RETRIES || "5", 10),
         baseRetryDelayInMs: parseInt(process.env.EVENT_CONSUMER_STARTUP_RETRY_STRATEGY_BASE_RETRY_DELAY_IN_MS || "1000", 10), // 1 second
         maxRetryDelayInMs: parseInt(process.env.EVENT_CONSUMER_STARTUP_RETRY_STRATEGY_MAX_RETRY_DELAY_IN_MS || "30000", 10), // 30 seconds
         jitterFactor: parseFloat(process.env.EVENT_CONSUMER_STARTUP_RETRY_STRATEGY_JITTER_FACTOR || "0.3"), // 0.3 means add up to 30% random jitter to avoid thundering herd problem
      },
   },

   cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: parseInt(process.env.COOKIE_MAX_AGE || `${8 * 60 * 60 * 1000}`, 10),
   },

   cors: {
      allowedOrigins: process.env.CORS_ALLOWED_ORIGINS
         ? process.env.CORS_ALLOWED_ORIGINS.split(",").map((o) => o.trim())
         : ["http://localhost:3000"],
   },

   apiKey: {
      hmacSecret: requireSecret("API_KEY_HMAC_SECRET", "dev-only-insecure-apikey-hmac-secret"),
   },
};
