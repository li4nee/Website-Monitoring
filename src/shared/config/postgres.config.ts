import pg from "pg";
import { globalConfig } from "./global.config";
import logger from "./logger.config";

class PostgresConnection {

    private pool: pg.Pool | null;
    constructor() {
        this.pool = null;
    }

    public async getPool(): Promise<pg.Pool> {
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
                })

                this.pool.on("error", (err) => {
                    logger.error("PostgreSQL pool error: %o", err);
                });

                logger.info("New PostgreSQL pool created successfully.");
                return this.pool;
            }
            return this.pool;
        
    }
}
