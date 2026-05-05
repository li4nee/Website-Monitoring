import { PostgresDB } from "../../../shared/infra/db/postgres/postgresClient";
import { sql } from "kysely";
import { EndpointMetrics } from "../../../shared/infra/db/postgres/postgresTypes";
import { EndPointMetricsBaseRepo } from "./endpointMetricsBase.repo";
import logger from "../../../shared/config/logger.config";

export class PgEndPointMetricsRepo extends EndPointMetricsBaseRepo<EndpointMetrics> {
   /** Upserts endpoint metrics into PostgreSQL. */
   async upsertEndpointMetrics(metrics: EndpointMetrics): Promise<void> {
      try {
         const {
            client_id,
            service_name,
            endpoint,
            method,
            total_hits,
            error_hits,
            max_latency,
            min_latency,
            time_bucket,
            total_latency,
         } = metrics;

         await PostgresDB.insertInto("endpoint_metrics")
            .values({
               id: sql`DEFAULT`,
               client_id,
               service_name,
               endpoint,
               method,
               time_bucket,

               total_hits,
               error_hits,
               total_latency,
               created_at: sql`NOW()`,
               updated_at: sql`NOW()`,
               max_latency,
               min_latency,
            })
            // Insert garda column match bhayera conflict aaye , update garne
            .onConflict((oc) =>
               oc.columns(["client_id", "service_name", "endpoint", "method", "time_bucket"]).doUpdateSet({
                  // Excluded is the data jun chai insert huna sakena
                  total_hits: sql`endpoint_metrics.total_hits + EXCLUDED.total_hits`,

                  error_hits: sql`endpoint_metrics.error_hits + EXCLUDED.error_hits`,

                  total_latency: sql`endpoint_metrics.total_latency + EXCLUDED.total_latency`,

                  // 1st value not null nikalne
                  max_latency: sql`
                     GREATEST(
                        COALESCE(endpoint_metrics.max_latency, EXCLUDED.max_latency),
                        EXCLUDED.max_latency
                     )
                  `,

                  min_latency: sql`
                     LEAST(
                        COALESCE(endpoint_metrics.min_latency, EXCLUDED.min_latency),
                        EXCLUDED.min_latency
                     )
                  `,

                  updated_at: sql`NOW()`,
               }),
            )
            .execute();
      } catch (error) {
         logger.error("Error upserting endpoint metrics", { error, metrics });
         throw error;
      }
   }

   /** Finds endpoint metrics using optional filters and sorting. */
   async findWithFilters(
      filters: Partial<EndpointMetrics>,
      limit: number,
      offset: number = 0,
      sortBy: string = "time_bucket",
      sortOrder: "ASC" | "DESC" = "DESC",
   ): Promise<EndpointMetrics[]> {
      try {
         let query = PostgresDB.selectFrom("endpoint_metrics").selectAll();

         const allowedSortColumns = [
            "id",
            "client_id",
            "time_bucket",
            "total_hits",
            "error_hits",
            "min_latency",
            "max_latency",
            "total_latency",
            "created_at",
            "updated_at",
         ] as const;

         type SortColumn = (typeof allowedSortColumns)[number];

         const isSortColumn = (value: string): value is SortColumn => (allowedSortColumns as readonly string[]).includes(value);

         const safeSortBy: SortColumn = isSortColumn(sortBy) ? sortBy : "time_bucket";
         const safeSortOrder = sortOrder === "ASC" ? "asc" : "desc";
         const safeLimit = Math.min(Math.max(limit, 1), 100);

         if (filters.client_id) {
            query = query.where("client_id", "=", filters.client_id);
         }
         if (filters.service_name) {
            query = query.where("service_name", "=", filters.service_name);
         }
         if (filters.endpoint) {
            query = query.where("endpoint", "=", filters.endpoint);
         }
         if (filters.method) {
            query = query.where("method", "=", filters.method);
         }
         if (filters.time_bucket) {
            query = query.where("time_bucket", "=", filters.time_bucket);
         }

         return await query.orderBy(safeSortBy, safeSortOrder).limit(safeLimit).offset(offset).execute();
      } catch (error) {
         logger.error("Error finding endpoint metrics with filters", { error, filters, limit, offset, sortBy, sortOrder });
         throw error;
      }
   }

   /** Returns top endpoints for a metric within an optional time range. Defaults to last 24 hours. */
   private async getTopEndpointsByMetric(
      metric: keyof EndpointMetrics,
      limit: number,
      startTime?: Date,
      clientId?: string,
   ): Promise<EndpointMetrics[]> {
      try {
         const safeLimit = Math.min(Math.max(limit, 1), 100);
         let query = PostgresDB.selectFrom("endpoint_metrics")
            .selectAll()
            .groupBy(["service_name", "endpoint", "method"])
            .orderBy(metric, "desc")
            .limit(safeLimit);

         // By default, only consider data from the last 24 hours.
         if (!startTime) {
            startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
         }

         if (startTime) {
            query = query.where("time_bucket", ">=", startTime);
         }

         // If clientId is not provided, return metrics for all clients.
         if (clientId) {
            query = query.where("client_id", "=", clientId);
         }

         return await query.execute();
      } catch (error) {
         logger.error("Error getting top endpoints by metric", { error, metric, limit, clientId });
         throw error;
      }
   }

   /** Gets top endpoints by total hits. */
   async getTopEndpointsByTotalHits(limit: number, startTime?: Date, clientId?: string): Promise<EndpointMetrics[]> {
      // 24 hours ko data nikalne by default
      if (!startTime) {
         startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      }
      return this.getTopEndpointsByMetric("total_hits", limit, startTime, clientId);
   }

   /** Gets top endpoints by error hits. */
   async getTopEndpointsByErrorHits(limit: number, startTime?: Date, clientId?: string): Promise<EndpointMetrics[]> {
      if (!startTime) {
         startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      }
      return this.getTopEndpointsByMetric("error_hits", limit, startTime, clientId);
   }

   /** Gets top endpoints by total latency. */
   async getTopEndpointsByTotalLatency(limit: number, startTime?: Date, clientId?: string): Promise<EndpointMetrics[]> {
      if (!startTime) {
         startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      }
      return this.getTopEndpointsByMetric("total_latency", limit, startTime, clientId);
   }

   async getTopEndpointsByAverageLatency(limit: number, startTime?: Date, clientId?: string): Promise<EndpointMetrics[]> {
      try {
         const safeLimit = Math.min(Math.max(limit, 1), 100);
         let query = PostgresDB.selectFrom("endpoint_metrics")
            .selectAll()
            .groupBy(["service_name", "endpoint", "method"])
            .orderBy(sql`total_latency::float / NULLIF(total_hits, 0)`, "desc")
            .limit(safeLimit);

         if (!startTime) {
            startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
         }

         if (startTime) {
            query = query.where("time_bucket", ">=", startTime);
         }

         if (clientId) {
            query = query.where("client_id", "=", clientId);
         }

         return await query.execute();
      } catch (error) {
         logger.error("Error getting top endpoints by average latency", { error, limit, clientId });
         throw error;
      }
   }
}
