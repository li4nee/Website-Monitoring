import * as path from "path";
import { promises as fs } from "fs";
import { FileMigrationProvider, Migrator } from "kysely";
import { PostgresDB } from "../src/shared/infra/db/postgres/postgresClient";
import logger from "../src/shared/config/logger.config";

const migrator = new Migrator({
   db: PostgresDB,
   provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, "../src/shared/infra/db/postgres/migrations"),
   }),
});

async function run() {
   const direction = process.argv[2] ?? "up";

   const result = direction === "down" ? await migrator.migrateDown() : await migrator.migrateToLatest();

   const { error, results } = result;

   results?.forEach((it) => {
      if (it.status === "Success") {
         logger.info(`[Migrate] "${it.migrationName}" executed successfully (${it.direction})`);
      } else if (it.status === "Error") {
         logger.error(`[Migrate] failed to execute "${it.migrationName}"`);
      }
   });

   if (!results?.length) {
      logger.info("[Migrate] No migrations to run — already up to date.");
   }

   await PostgresDB.destroy();

   if (error) {
      logger.error("[Migrate] Migration run failed", { error });
      process.exit(1);
   }

   process.exit(0);
}

run();
