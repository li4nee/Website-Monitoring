import pg from "pg";
import { globalConfig } from "./global.config";
import logger from "./logger.config";

/**
 * PostgreSQL connection manager class. Semi Singleton.
 */
class PostgresConnection {
   private pool: pg.Pool | null;
   constructor() {
      this.pool = null;
   }

   /**
    * Returns the PostgreSQL connection pool.
    * If the pool does not exist, it creates a new one.
    * @returns {pg.Pool}
    */
   getPool(): pg.Pool {
      if (!this.pool) {
         this.pool = new pg.Pool({
            host: globalConfig.postgres.host,
            port: globalConfig.postgres.port,
            user: globalConfig.postgres.user,
            password: globalConfig.postgres.password,
            database: globalConfig.postgres.database,
            max: globalConfig.postgres.maxPoolSize, // parallel kati ota connections chalcha
            idleTimeoutMillis: globalConfig.postgres.idleTimeoutMillis, // koi le connection liyo ani use nagareko bela kati time samma connection idle ma rakhne
            connectionTimeoutMillis: globalConfig.postgres.connectionTimeoutMillis, // connection establish garna kati time samma try garne
         });

         this.pool.on("error", (err) => {
            logger.error("PostgreSQL pool error: %o", err);
         });

         logger.info("New PostgreSQL pool created successfully.");
         return this.pool;
      }
      return this.pool;
   }

   /**
    * Tests the PostgreSQL connection by executing a simple query to retrieve the current date and time from the server.
    * Logs the result if successful, or logs an error if the connection test fails.
    * @returns {Promise<void>}
    */
   async testConnection(): Promise<void> {
      try {
         const pool = this.getPool();
         const client = await pool.connect();
         const result = await client.query("SELECT NOW()"); // returns the current date and time from the PostgreSQL server
         logger.info("PostgreSQL connection test successful: %o", result.rows[0].now);
         client.release();
      } catch (error) {
         logger.error("PostgreSQL connection test failed: %o", error);
         throw error;
      }
   }

   /**
    * Executes a SQL query using the PostgreSQL connection pool.
    * @param text Your SQL query text
    * @param params Your SQL query parameters (optional) like values for placeholders in the query
    * @returns {Promise<pg.QueryResult>}
    */
   async query(text: string, params?: any[]): Promise<pg.QueryResult> {
      const pool = this.getPool();
      const start = Date.now();
      try {
         const result = await pool.query(text, params);
         const duration = Date.now() - start;
         logger.debug("PostgreSQL query executed: %o, duration: %d ms", { text, params }, duration);
         return result;
      } catch (error) {
         logger.error("PostgreSQL query error for %o: %o", { text, params }, error);
         throw error;
      }
   }

   /**
    * Closes the PostgreSQL connection pool if it exists.
    */
   async disconnect(): Promise<void> {
      if (this.pool) {
         await this.pool.end();
         logger.info("PostgreSQL pool has been closed successfully.");
         this.pool = null;
      } else {
         logger.warn("No PostgreSQL pool to disconnect.");
      }
   }
}

export default new PostgresConnection();
