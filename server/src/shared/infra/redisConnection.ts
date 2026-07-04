import Redis from "ioredis";
import { globalConfig } from "../config/global.config";
import logger from "../config/logger.config";

/**
 * Redis connection manager class. Semi Singleton.
 * Backs the cross-instance idempotency store used by the event consumer.
 */
class RedisConnection {
   private client: Redis | null = null;

   getClient(): Redis {
      if (!this.client) {
         this.client = new Redis(globalConfig.redis.url, {
            lazyConnect: true,
            maxRetriesPerRequest: 3,
         });

         this.client.on("error", (err) => {
            logger.error("Redis client error: %o", err);
         });
      }
      return this.client;
   }

   async connect(): Promise<void> {
      const client = this.getClient();
      if (client.status === "ready" || client.status === "connecting") return;
      await client.connect();
      logger.info("Redis connection established.");
   }

   async disconnect(): Promise<void> {
      if (this.client) {
         await this.client.quit();
         this.client = null;
         logger.info("Redis connection closed.");
      }
   }

   async getConnectionStatus(): Promise<boolean> {
      if (!this.client) return false;
      try {
         const pong = await this.client.ping();
         return pong === "PONG";
      } catch {
         return false;
      }
   }
}

export default new RedisConnection();
export { RedisConnection };
