import redisConnection from "../redisConnection";
import logger from "../../config/logger.config";
import { globalConfig } from "../../config/global.config";

const KEY_PREFIX = "cache:apikey:";

export interface ApiKeyLookupResult {
   client: { id: string; name: string; slug: string; isActive: boolean };
   apiKey: {
      id: string;
      keyId: string;
      name: string;
      permissions: { writeAccess: boolean; readAccess: boolean };
   };
}

/**
 * Caches resolved API keys so ingest requests don't keep hitting the DB.
 * Keeps a short TTL so revoked keys expire quickly.
 */
export class ApiKeyCache {
   static async get(hashedKeyValue: string): Promise<ApiKeyLookupResult | null> {
      try {
         const raw = await redisConnection.getClient().get(`${KEY_PREFIX}${hashedKeyValue}`);
         return raw ? (JSON.parse(raw) as ApiKeyLookupResult) : null;
      } catch (error) {
         logger.error("[ApiKeyCache] Redis read failed, falling back to DB", {
            error: error instanceof Error ? error.message : error,
         });
         return null;
      }
   }

   static async set(hashedKeyValue: string, result: ApiKeyLookupResult): Promise<void> {
      try {
         await redisConnection
            .getClient()
            .set(`${KEY_PREFIX}${hashedKeyValue}`, JSON.stringify(result), "EX", globalConfig.apiKey.cacheTtlSeconds);
      } catch (error) {
         logger.error("[ApiKeyCache] Redis write failed", { error: error instanceof Error ? error.message : error });
      }
   }

   static async invalidate(hashedKeyValue: string): Promise<void> {
      try {
         await redisConnection.getClient().del(`${KEY_PREFIX}${hashedKeyValue}`);
      } catch (error) {
         logger.error("[ApiKeyCache] Redis invalidation failed", { error: error instanceof Error ? error.message : error });
      }
   }
}
