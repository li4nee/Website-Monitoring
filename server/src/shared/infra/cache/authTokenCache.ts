import redisConnection from "../redisConnection";
import logger from "../../config/logger.config";

export const EMAIL_VERIFICATION_TOKEN_PREFIX = "auth:email-verify:";
export const PASSWORD_RESET_TOKEN_PREFIX = "auth:password-reset:";

export class AuthTokenCache {
   static async store(prefix: string, tokenHash: string, userId: string, ttlSeconds: number): Promise<void> {
      await redisConnection.getClient().set(`${prefix}${tokenHash}`, userId, "EX", ttlSeconds);
   }

   /** Looks up and atomically deletes the token so it can't be replayed. Returns the userId, or null if missing/expired. */
   static async consume(prefix: string, tokenHash: string): Promise<string | null> {
      const key = `${prefix}${tokenHash}`;
      const client = redisConnection.getClient();

      try {
         const userId = await client.get(key);
         if (userId === null) return null;

         await client.del(key);
         return userId;
      } catch (error) {
         logger.error("[AuthTokenCache] Redis lookup failed", { error: error instanceof Error ? error.message : error, prefix });
         return null;
      }
   }
}
