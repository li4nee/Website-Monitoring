import { globalConfig } from "../../../shared/config/global.config";
import logger from "../../../shared/config/logger.config";
import { RetryStrategy } from "../../../shared/infra/resilience/retryStrategy.infra";
import { RetryStrategyOptions } from "../../../shared/typings/retry.typings";
import AlertingWorkerDependenciesContainer from "./dependencies/alertingWorker.dependency";

const alertingWorkerDependencies = AlertingWorkerDependenciesContainer.init();

class AlertingWorkerStartup {
   private static isShuttingDown = false;

   private static async shutdown(signal: string) {
      if (this.isShuttingDown) {
         return;
      }

      this.isShuttingDown = true;
      logger.info(`${signal} received. Shutting down alerting worker gracefully...`);

      try {
         await alertingWorkerDependencies.worker.stop();
         logger.info("Alerting Worker stopped successfully. Exiting process.");
         process.exit(0);
      } catch (error) {
         logger.error("Error during alerting worker shutdown:", { error: (error as Error).message });
         process.exit(1);
      }
   }

   private static async startWorkerWithRetry() {
      const retryStrategyOptions: RetryStrategyOptions = {
         maxRetries: globalConfig.alertingWorker.startupRetryStrategyOptions.maxRetries ?? 5,
         baseRetryDelayInMs: globalConfig.alertingWorker.startupRetryStrategyOptions.baseRetryDelayInMs ?? 1000,
         maxRetryDelayInMs: globalConfig.alertingWorker.startupRetryStrategyOptions.maxRetryDelayInMs ?? 30000,
         jitterFactor: globalConfig.alertingWorker.startupRetryStrategyOptions.jitterFactor ?? 0.3,
      };
      const retryStrategy = new RetryStrategy(retryStrategyOptions);
      const maxRetries = retryStrategyOptions.maxRetries ?? 5;

      let attempt = 0;

      while (attempt < maxRetries) {
         try {
            await alertingWorkerDependencies.worker.start();
            logger.info("[Alerting Worker] Started successfully");
            return;
         } catch (error) {
            attempt++;
            logger.error("[Alerting Worker] Failed to start", {
               attempt,
               error: (error as Error).message,
            });

            if (!retryStrategy.shouldRetry(attempt)) {
               logger.error("[Alerting Worker] Max startup retry attempts reached. Exiting process.");
               process.exit(1);
            }

            const delay = retryStrategy.getRetryDelay(attempt);
            logger.info(`[Alerting Worker] Retrying startup in ${delay} ms`);
            await retryStrategy.waitForRetry(attempt);
         }
      }

      logger.error("[Alerting Worker] Failed to start after retry loop. Exiting process.");
      process.exit(1);
   }

   static registerProcessHandlers() {
      process.on("unhandledRejection", (reason, promise) => {
         logger.error("Unhandled Rejection at:", { promise, reason });
         process.exit(1);
      });

      process.on("uncaughtException", (error) => {
         logger.error("Uncaught Exception thrown:", { error });
         process.exit(1);
      });

      process.on("SIGINT", async () => {
         await this.shutdown("SIGINT");
      });

      process.on("SIGTERM", async () => {
         await this.shutdown("SIGTERM");
      });
   }

   static async start() {
      this.registerProcessHandlers();
      await this.startWorkerWithRetry();
   }
}

AlertingWorkerStartup.start().catch((error) => {
   logger.error("Failed to start AlertingWorkerStartup", { error: (error as Error).message });
   process.exit(1);
});
