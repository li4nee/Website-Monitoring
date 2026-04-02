import express from "express";
import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { globalConfig } from "./shared/config/global.config";
import logger from "./shared/config/logger.config";
import mongoConnection from "./shared/config/mongo.config";
import postgresConnection from "./shared/config/postgres.config";
import amqpConnection from "./shared/config/amqp.config";
import { ResponseFormatter } from "./shared/utils/responseFormatter.utils";
import { ResourceNotFoundError } from "./shared/typings/error.typings";
import { GlobalErrorHandler } from "./shared/middleware/globalErrorHandler.middleware";
import CookieParser from "cookie-parser";
import AuthRouter from "./modules/auth/routes/auth.routes";
import { CentralizedRequestLogger } from "./shared/middleware/requestLogger.middleware";
const app = express();

/**
 * Initialize middlewares
 */
app.use(helmet());
app.use(
   cors({
      origin: true,
      credentials: true,
   }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(CookieParser());
// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
   return CentralizedRequestLogger(req, res, next);
});

/**
 * Health check
 */
app.get("/health", async (req: Request, res: Response) => {
   try {
      const [mongoStatus, postgresStatus, amqpStatus] = await Promise.all([
         mongoConnection.getConnectionStatus(),
         postgresConnection.checkConnectionStatus(),
         amqpConnection.getConnectionStatus(),
      ]);

      return res.status(200).json(
         ResponseFormatter.success("Server is healthy", 200, {
            connectionStatus: { mongo: mongoStatus, postgres: postgresStatus, amqp: amqpStatus },
            status: "HEALTHY",
            uptime: process.uptime(),
         }),
      );
   } catch (err) {
      return res.status(500).json(ResponseFormatter.error("Health check failed", 500, err));
   }
});

/**
 * Root endpoint
 */
app.get("/", (req: Request, res: Response) => {
   res.status(200).json(
      ResponseFormatter.success("Welcome to the Server Monitoring API", 200, {
         version: globalConfig.version,
      }),
   );
});

/**
 * Route handlers
 */
app.use("/api/v1/auth", AuthRouter);

/**
 * 404 handler
 */
app.use((req: Request, res: Response, next: NextFunction) => {
   next(new ResourceNotFoundError(`Cannot find endpoint: ${req.method} ${req.path}`));
});

/**
 * Graceful shutdown
 */
let server: ReturnType<typeof app.listen>;

const gracefulShutdown = async () => {
   logger.info("Received shutdown signal, closing server and connections...");

   try {
      if (server) {
         await new Promise<void>((resolve, reject) => {
            server.close((err) => (err ? reject(err) : resolve()));
         });
         logger.info("HTTP server closed");
      }

      await mongoConnection.disconnect();
      await postgresConnection.disconnect();
      await amqpConnection.close();

      logger.info("Server and all connections closed gracefully");
      process.exit(0);
   } catch (error) {
      logger.error("Error during server shutdown", { error });
      setTimeout(() => process.exit(1), 5000);
   }
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
process.on("uncaughtException", (err) => {
   logger.error("Uncaught Exception", { error: err });
   gracefulShutdown();
});
process.on("unhandledRejection", (reason, promise) => {
   logger.error("Unhandled Rejection at:", { promise, reason });
   gracefulShutdown();
});

/**
 * Initialize connections and start server
 */
const startServer = async () => {
   try {
      logger.info("Initializing connections to MongoDB, PostgreSQL, and RabbitMQ...");
      await Promise.all([mongoConnection.connect(), postgresConnection.testConnection(), amqpConnection.connect()]);

      logger.info("All connections initialized successfully");

      server = app.listen(globalConfig.port, () => {
         logger.info(`Server is running on port ${globalConfig.port}`);
         logger.info(`Node environment: ${globalConfig.node_env}`);
      });
   } catch (error) {
      logger.error("Failed to start the server", { error });
      process.exit(1);
   }
};

// Global error handler
app.use(GlobalErrorHandler.handleError);

startServer();
