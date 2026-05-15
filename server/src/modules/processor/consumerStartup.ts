import { globalConfig } from "../../shared/config/global.config";
import logger from "../../shared/config/logger.config";
import { RetryStrategy } from "../../shared/infra/resilience/retryStrategy.infra";
import { RetryStrategyOptions } from "../../shared/typings/retry.typings";
import ProcessorDependenciesContainer from "./dependencies/processor.dependency";

const processorDependencies = ProcessorDependenciesContainer.init();

class ConsumerStartup {
   private static isShuttingDown = false;

   private static async shutdown(signal: string) {
      if (this.isShuttingDown) {
         return;
      }

      this.isShuttingDown = true;
      logger.info(`${signal} received. Shutting down gracefully...`);

      try {
         await processorDependencies.consumers.eventConsumer.stop();
         logger.info("Event Consumer stopped successfully. Exiting process.");
         process.exit(0);
      } catch (error) {
         logger.error("Error during shutdown:", { error: (error as Error).message });
         process.exit(1);
      }
   }

   private static async startEventConsumerWithRetry() {
      const retryStrategyOptions: RetryStrategyOptions = {
         maxRetries: globalConfig.consumer?.eventConsumerStrategyRetryStrategyOptions?.maxRetries ?? 5,
         baseRetryDelayInMs: globalConfig.consumer?.eventConsumerStrategyRetryStrategyOptions?.baseRetryDelayInMs ?? 1000,
         maxRetryDelayInMs: globalConfig.consumer?.eventConsumerStrategyRetryStrategyOptions?.maxRetryDelayInMs ?? 30000,
         jitterFactor: globalConfig.consumer?.eventConsumerStrategyRetryStrategyOptions?.jitterFactor ?? 0.3,
      };
      const retryStrategy = new RetryStrategy(retryStrategyOptions);
      const maxRetries = retryStrategyOptions.maxRetries ?? 5;

      let attempt = 0;

      while (attempt < maxRetries) {
         try {
            await processorDependencies.consumers.eventConsumer.start();
            logger.info("[Event Consumer] Started successfully");
            return;
         } catch (error) {
            attempt++;
            logger.error("[Event Consumer] Failed to start", {
               attempt,
               error: (error as Error).message,
            });

            if (!retryStrategy.shouldRetry(attempt)) {
               logger.error("[Event Consumer] Max startup retry attempts reached. Exiting process.");
               process.exit(1);
            }

            const delay = retryStrategy.getRetryDelay(attempt);
            logger.info(`[Event Consumer] Retrying startup in ${delay} ms`);
            await retryStrategy.waitForRetry(attempt);
         }
      }

      logger.error("[Event Consumer] Failed to start after retry loop. Exiting process.");
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
      await this.startEventConsumerWithRetry();
   }
}

ConsumerStartup.start().catch((error) => {
   logger.error("Failed to start ConsumerStartup", { error: (error as Error).message });
   process.exit(1);
});
