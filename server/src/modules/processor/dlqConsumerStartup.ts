import logger from "../../shared/config/logger.config";
import mongoConnection from "../../shared/infra/db/mongo/mongoConnection";
import { DLQConsumer } from "./dlqConsumer";

const dlqConsumer = new DLQConsumer(mongoConnection);

class DLQConsumerStartup {
   private static isShuttingDown = false;

   private static async shutdown(signal: string) {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      logger.info(`${signal} received. Shutting down DLQ consumer...`);
      try {
         await dlqConsumer.stop();
         logger.info("DLQ Consumer stopped. Exiting.");
         process.exit(0);
      } catch (error) {
         logger.error("Error during DLQ consumer shutdown", { error: (error as Error).message });
         process.exit(1);
      }
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

      process.on("SIGINT", async () => this.shutdown("SIGINT"));
      process.on("SIGTERM", async () => this.shutdown("SIGTERM"));
   }

   static async start() {
      this.registerProcessHandlers();
      await dlqConsumer.start();
   }
}

DLQConsumerStartup.start().catch((error) => {
   logger.error("Failed to start DLQ Consumer", { error: (error as Error).message });
   process.exit(1);
});
