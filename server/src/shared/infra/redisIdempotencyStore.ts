import Redis from "ioredis";
import { IIdempotencyStore } from "../contracts/infra/IIdempotencyStore.contract";
import logger from "../config/logger.config";

const KEY_PREFIX = "idempotency:api_hits:";

export class RedisIdempotencyStore implements IIdempotencyStore {
   constructor(
      private readonly client: Redis,
      private readonly ttlSeconds: number,
   ) {}

   async hasProcessed(messageId: string): Promise<boolean> {
      try {
         const value = await this.client.get(`${KEY_PREFIX}${messageId}`);
         return value !== null;
      } catch (error) {
         // If Redis is unreachable, fail open (treat as "not yet processed")
         // rather than blocking the whole pipeline on a cache being down —
         // worst case is an occasional duplicate write, which is preferable to
         // dropping/stalling all event processing.
         logger.error("[RedisIdempotencyStore] Failed to check messageId, failing open", {
            messageId,
            error: error instanceof Error ? error.message : error,
         });
         return false;
      }
   }

   async markProcessed(messageId: string): Promise<void> {
      try {
         await this.client.set(`${KEY_PREFIX}${messageId}`, "1", "EX", this.ttlSeconds);
      } catch (error) {
         logger.error("[RedisIdempotencyStore] Failed to mark messageId as processed", {
            messageId,
            error: error instanceof Error ? error.message : error,
         });
      }
   }
}
