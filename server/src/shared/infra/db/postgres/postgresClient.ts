import { Kysely, PostgresDialect } from "kysely";
import postgresConnection from "./postgresConnection";
import { DB } from "./postgresTypes";

const pool = postgresConnection.getPool();

export const PostgresDB = new Kysely<DB>({
   dialect: new PostgresDialect({
      pool,
   }),
});
