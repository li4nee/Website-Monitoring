import { Kysely, sql } from "kysely";

// Mirrors scripts/init-postgres.sql (kept for fresh docker-compose bootstrap via
// /docker-entrypoint-initdb.d/) — this migration is the source of truth going
// forward for schema changes in already-running environments.
export async function up(db: Kysely<any>): Promise<void> {
   await db.schema
      .createTable("endpoint_metrics")
      .ifNotExists()
      .addColumn("id", "bigserial", (col) => col.primaryKey())
      .addColumn("client_id", "varchar(24)", (col) => col.notNull())
      .addColumn("service_name", "varchar(255)", (col) => col.notNull())
      .addColumn("endpoint", "varchar(500)", (col) => col.notNull())
      .addColumn("method", "varchar(10)", (col) => col.notNull())
      .addColumn("time_bucket", "timestamptz", (col) => col.notNull())
      .addColumn("total_hits", "integer", (col) => col.defaultTo(0))
      .addColumn("error_hits", "integer", (col) => col.defaultTo(0))
      .addColumn("min_latency", "double precision", (col) => col.defaultTo(0.0))
      .addColumn("max_latency", "double precision", (col) => col.defaultTo(0.0))
      .addColumn("total_latency", "double precision", (col) => col.defaultTo(0.0))
      .addColumn("created_at", "timestamptz", (col) => col.defaultTo(sql`current_timestamp`))
      .addColumn("updated_at", "timestamptz", (col) => col.defaultTo(sql`current_timestamp`))
      .addUniqueConstraint("uq_endpoint_metrics_bucket", ["client_id", "service_name", "endpoint", "method", "time_bucket"])
      .execute();

   await db.schema
      .createIndex("idx_endpoint_metrics_service")
      .ifNotExists()
      .on("endpoint_metrics")
      .columns(["client_id", "service_name"])
      .execute();

   await db.schema
      .createIndex("idx_endpoint_metrics_endpoint")
      .ifNotExists()
      .on("endpoint_metrics")
      .columns(["client_id", "service_name", "endpoint"])
      .execute();

   await db.schema
      .createIndex("idx_metrics_client_service_time")
      .ifNotExists()
      .on("endpoint_metrics")
      .columns(["client_id", "service_name", "time_bucket"])
      .execute();

   await sql`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
         NEW.updated_at = CURRENT_TIMESTAMP;
         RETURN NEW;
      END;
      $$ language 'plpgsql';
   `.execute(db);

   await sql`DROP TRIGGER IF EXISTS update_endpoint_metrics_updated_at ON endpoint_metrics`.execute(db);

   await sql`
      CREATE TRIGGER update_endpoint_metrics_updated_at
      BEFORE UPDATE ON endpoint_metrics
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
   `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
   await sql`DROP TRIGGER IF EXISTS update_endpoint_metrics_updated_at ON endpoint_metrics`.execute(db);
   await sql`DROP FUNCTION IF EXISTS update_updated_at_column()`.execute(db);
   await db.schema.dropTable("endpoint_metrics").ifExists().execute();
}
