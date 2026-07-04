import mongoConnection from "../src/shared/infra/db/mongo/mongoConnection";
import { ApiHitModel } from "../src/shared/infra/db/mongo/models/apiHits.model";
import { ClientRetentionCache } from "../src/shared/infra/cache/clientRetentionCache";
import logger from "../src/shared/config/logger.config";

// One-off backfill: apiHits.model.ts's `expiresAt` TTL field was added after
// this collection already had data. Documents written before that change have
// no `expiresAt` and would otherwise NEVER expire under the new
// {expiresAt:1, expireAfterSeconds:0} index (Mongo TTL only expires documents
// that actually have the indexed field). Safe to re-run — it only ever
// touches documents still missing the field.
const BATCH_SIZE = 500;

async function run() {
   await mongoConnection.connect();

   let totalUpdated = 0;

   for (;;) {
      const batch = await ApiHitModel.find({ expiresAt: { $exists: false } })
         .select("_id clientId timestamp")
         .limit(BATCH_SIZE)
         .lean();

      if (batch.length === 0) break;

      const bulkOps = await Promise.all(
         batch.map(async (doc) => {
            const retentionDays = await ClientRetentionCache.getRetentionDays(doc.clientId.toString());
            const expiresAt = new Date(new Date(doc.timestamp).getTime() + retentionDays * 24 * 60 * 60 * 1000);
            return {
               updateOne: {
                  filter: { _id: doc._id },
                  update: { $set: { expiresAt } },
               },
            };
         }),
      );

      const result = await ApiHitModel.bulkWrite(bulkOps);
      totalUpdated += result.modifiedCount;
      logger.info(`[BackfillApiHitExpiry] Updated ${totalUpdated} documents so far...`);
   }

   logger.info(`[BackfillApiHitExpiry] Done. Total documents updated: ${totalUpdated}`);
   await mongoConnection.disconnect();
   process.exit(0);
}

run().catch((error) => {
   logger.error("[BackfillApiHitExpiry] Failed", { error: error instanceof Error ? error.message : error });
   process.exit(1);
});
