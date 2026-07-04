import express from "express";
import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { globalConfig } from "./shared/config/global.config";
import logger from "./shared/config/logger.config";
import mongoConnection from "./shared/infra/db/mongo/mongoConnection";
import postgresConnection from "./shared/infra/db/postgres/postgresConnection";
import amqpConnection from "./shared/infra/amqpConnection";
import { ResponseFormatter } from "./shared/utils/responseFormatter.utils";
import { CORSError, ResourceNotFoundError } from "./shared/typings/error.typings";
import { GlobalErrorHandler } from "./shared/middleware/globalErrorHandler.middleware";
import CookieParser from "cookie-parser";
import AuthRouter from "./modules/auth/routes/auth.route";
import ClientAdminRouter from "./modules/client/routes/clientAdmin.route";
import IngestRouter from "./modules/ingest/routes/ingest.routes";
import AnalyticsRouter from "./modules/analytics/routes/analytics.route";
import AlertingRouter from "./modules/alerting/routes/alerting.route";
import AuditLogRouter from "./modules/audit/routes/auditLog.route";
import { CentralizedRequestLogger } from "./shared/middleware/requestLogger.middleware";
const app = express();

/**
 * Initialize middlewares
 */
app.use(
   helmet({
      // Only for production.
      // forces browsers to always use HTTPS. Servers can still send http.
      // hsts: {
      //    maxAge: 31536000,
      //    includeSubDomains: true,
      //    preload: true, // preload true bhaye 1st request mai https ma hancha.
      // },
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: "no-referrer" },
   }),
);
// No x-powered-by express
app.disable("x-powered-by");

app.use(
   cors({
      origin: (origin, callback) => {
         // allow non-browser / server-to-server requests with no origin
         if (!origin) return callback(null, true);
         if (globalConfig.cors.allowedOrigins.includes(origin)) return callback(null, true);
         callback(new CORSError(`CORS: origin '${origin}' not allowed`));
      },
      credentials: true,
   }),
);

// limit the body's size
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(CookieParser());
// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
   return CentralizedRequestLogger(req, res, next);
});

// For ip behind nginx.
app.set("trust proxy", 1);

/**
 * Health check
 */
app.get("/health", async (req: Request, res: Response) => {
   const isProduction = globalConfig.node_env === "production";
   try {
      const [mongoStatus, postgresStatus, amqpStatus] = await Promise.all([
         mongoConnection.getConnectionStatus(),
         postgresConnection.checkConnectionStatus(),
         amqpConnection.getConnectionStatus(),
      ]);

      const allHealthy = mongoStatus && postgresStatus && amqpStatus;
      const statusCode = allHealthy ? 200 : 503;

      // Hide the connection details in prod.
      return res.status(statusCode).json(
         ResponseFormatter.success(allHealthy ? "Server is healthy" : "Server is degraded", statusCode, {
            status: allHealthy ? "HEALTHY" : "DEGRADED",
            uptime: process.uptime(),
            ...(isProduction ? {} : { connectionStatus: { mongo: mongoStatus, postgres: postgresStatus, amqp: amqpStatus } }),
         }),
      );
   } catch (err) {
      return res.status(503).json(ResponseFormatter.error("Health check failed", 503, isProduction ? null : err));
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
app.use("/api/v1/admin/clients", ClientAdminRouter);
app.use("/api/v1/ingest", IngestRouter);
app.use("/api/v1/analytics", AnalyticsRouter);
app.use("/api/v1/alerting", AlertingRouter);
app.use("/api/v1/audit-logs", AuditLogRouter);
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
