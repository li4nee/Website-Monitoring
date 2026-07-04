import mongoConnection from "../src/shared/infra/db/mongo/mongoConnection";
import { ApiHitModel } from "../src/shared/infra/db/mongo/models/apiHits.model";
import logger from "../src/shared/config/logger.config";

// One-off maintenance command: reconciles live MongoDB indexes with what's
// currently defined on each model (creates missing ones, drops ones that were
// removed from the schema). Mongoose's default autoIndex-on-boot only adds
// missing indexes, so schema changes that remove/replace an index (e.g. the
// apiHits TTL field switch) need this run manually after deploying.
const MODELS = [ApiHitModel];

async function run() {
   await mongoConnection.connect();

   for (const model of MODELS) {
      logger.info(`[SyncIndexes] Syncing indexes for model "${model.modelName}"...`);
      const dropped = await model.syncIndexes();
      logger.info(`[SyncIndexes] "${model.modelName}" done. Indexes dropped/changed: ${JSON.stringify(dropped)}`);
   }

   await mongoConnection.disconnect();
   process.exit(0);
}

run().catch((error) => {
   logger.error("[SyncIndexes] Failed", { error: error instanceof Error ? error.message : error });
   process.exit(1);
});
