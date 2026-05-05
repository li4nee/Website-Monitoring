import winston from "winston";
import { globalConfig } from "./global.config";
/**
 * Custom log format for pretty console output in development.
 */
const devFormat = winston.format.combine(
   winston.format.colorize(),
   winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
   winston.format.printf(
      ({ timestamp, level, message, ...meta }) =>
         `${timestamp} [${level}] ${message}${Object.keys(meta).length ? ` ${JSON.stringify(meta, null, 2)}` : ""}`,
   ),
);

/**
 * JSON format for production logging.
 */
const prodFormat = winston.format.combine(
   winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
   winston.format.errors({ stack: true }),
   winston.format.splat(),
   winston.format.json(),
);

const logger = winston.createLogger({
   level: globalConfig.node_env === "production" ? "info" : "debug",
   format: globalConfig.node_env === "production" ? prodFormat : devFormat,
   defaultMeta: { service: "server-monitoring-service" },
   transports: [
      new winston.transports.File({ filename: "logs/error.log", level: "error" }),
      new winston.transports.File({ filename: "logs/combined.log" }),
   ],
});

// Add pretty console logging in development
if (globalConfig.node_env !== "production") {
   logger.add(
      new winston.transports.Console({
         format: devFormat,
      }),
   );
}

export const requestLogger = winston.createLogger({
   level: "info",
   format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(
         ({ timestamp, message, ...meta }) => `[${timestamp}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ""}`,
      ),
   ),
   transports: [new winston.transports.File({ filename: "logs/requests.log" })],
});

export default logger;
