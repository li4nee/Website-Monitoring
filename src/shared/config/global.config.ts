import dotenv from "dotenv";
import { url } from "node:inspector";
dotenv.config();

/**
 * Global configuration object that holds all the necessary configuration values for the application.
 */
export const globalConfig = {
   node_env: process.env.NODE_ENV || "development",
   port: parseInt(process.env.PORT || "4000", 10),

   // JWT
   jwt: {
      secret: process.env.JWT_SECRET || "1234567890@abcdefg",
      expiresIn: process.env.JWT_EXPIRES_IN || "12h",
   },

   // rateLimit
   rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10), // 1 minute
      max: parseInt(process.env.RATE_LIMIT_MAX || "15", 10), // 100 requests per windowMs
      protectedMax: parseInt(process.env.RATE_LIMIT_PROTECTED_MAX || "30", 10), // 50 requests per windowMs for protected routes
   },

   //mongodb
   mongo: {
      url: process.env.MONGO_URL || "mongodb://localhost:27017/server_monitoring",
      dbName: process.env.MONGO_DB_NAME || "myapp",
   },

   //postgresql
   postgres: {
      host: process.env.POSTGRES_HOST || "localhost",
      port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
      user: process.env.POSTGRES_USER || "postgres",
      password: process.env.POSTGRES_PASSWORD || "1234567890",
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
      retryAttempts: parseInt(process.env.RABBITMQ_RETRY_ATTEMPTS || "3", 10),
      retryDelay: parseInt(process.env.RABBITMQ_RETRY_DELAY || "1000", 10), // ms ma ho yo
   },
};
