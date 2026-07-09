import { ClientModel } from "../db/mongo/models/client.model";
import logger from "../../config/logger.config";
import redisConnection from "../redisConnection";
import { globalConfig } from "../../config/global.config";

const DEFAULT_RETENTION_DAYS = 30;
const KEY_PREFIX = "cache:client_retention:";

/**
 * Maps clientId -> Client.settings.dataRetentionPeriod so the processor
 * doesn't hit Mongo for a client-settings lookup on every single ingested
 * event. Backed by Redis (shared across consumer instances) rather than a
 * local Map, so scaling out horizontally doesn't multiply the Mongo lookups
 * and a retention change is picked up by every instance on the same TTL
 * instead of drifting per-process.
 */
export class ClientRetentionCache {
   static async getRetentionDays(clientId: string): Promise<number> {
      const key = `${KEY_PREFIX}${clientId}`;

      try {
         const cached = await redisConnection.getClient().get(key);
         if (cached !== null) return Number(cached);
      } catch (error) {
         // If Redis is unreachable, fall through to Mongo rather than
         // blocking event processing on a cache being down.
         logger.error(`[ClientRetentionCache] Redis lookup failed for client ${clientId}, falling back to Mongo`, {
            error: error instanceof Error ? error.message : error,
         });
      }

      try {
         const client = await ClientModel.findById(clientId).select("settings.dataRetentionPeriod").lean();
         const retentionDays = client?.settings?.dataRetentionPeriod ?? DEFAULT_RETENTION_DAYS;

         redisConnection
            .getClient()
            .set(key, retentionDays, "EX", globalConfig.consumer.retentionCacheTtlSeconds)
            .catch((error) => {
               logger.error(`[ClientRetentionCache] Failed to write cache for client ${clientId}`, {
                  error: error instanceof Error ? error.message : error,
               });
            });

         return retentionDays;
      } catch (error) {
         logger.error(`[ClientRetentionCache] Failed to look up retention period for client ${clientId}, using default`, {
            error: error instanceof Error ? error.message : error,
         });
         return DEFAULT_RETENTION_DAYS;
      }
   }
}
