import { ClientModel } from "../db/mongo/models/client.model";
import logger from "../../config/logger.config";

const DEFAULT_RETENTION_DAYS = 30;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
   retentionDays: number;
   expiresAt: number;
}

/**
 * Maps clientId -> Client.settings.dataRetentionPeriod so the processor
 * doesn't hit Mongo for a client-settings lookup on every single ingested
 * event. Refreshed on a short TTL (rather than cached forever) so a tenant's
 * retention change takes effect within a few minutes instead of requiring a
 * process restart.
 */
export class ClientRetentionCache {
   private static cache = new Map<string, CacheEntry>();

   static async getRetentionDays(clientId: string): Promise<number> {
      const cached = this.cache.get(clientId);
      if (cached && cached.expiresAt > Date.now()) {
         return cached.retentionDays;
      }

      try {
         const client = await ClientModel.findById(clientId).select("settings.dataRetentionPeriod").lean();
         const retentionDays = client?.settings?.dataRetentionPeriod ?? DEFAULT_RETENTION_DAYS;
         this.cache.set(clientId, { retentionDays, expiresAt: Date.now() + CACHE_TTL_MS });
         return retentionDays;
      } catch (error) {
         logger.error(`[ClientRetentionCache] Failed to look up retention period for client ${clientId}, using default`, {
            error: error instanceof Error ? error.message : error,
         });
         return DEFAULT_RETENTION_DAYS;
      }
   }
}
