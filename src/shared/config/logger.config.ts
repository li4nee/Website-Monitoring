import winston from "winston";
import { globalConfig } from "./global.config";

/**
 * Winston logger configuration.
 * Logs are written to files in production and also to the console in development.
 */
const logger = winston.createLogger({
   level: globalConfig.node_env === "production" ? "info" : "debug",
   format: winston.format.combine(
      winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json(),
   ),
   defaultMeta: { service: "server-monitoring-service" },
   transports: [
      new winston.transports.File({ filename: "logs/error.log", level: "error" }),
      new winston.transports.File({ filename: "logs/combined.log" }),
   ],
});

if (globalConfig.node_env !== "production") {
   logger.add(
      new winston.transports.Console({
         format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
      }),
   );
}

export default logger;
