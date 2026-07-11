import logger from "../../../shared/config/logger.config";
import { ResourceNotInitializedError } from "../../../shared/typings/error.typings";
import { EndpointMetrics } from "../../../shared/infra/db/postgres/postgresTypes";
import { UserInsideAuthorizedRequest } from "../../../shared/typings/auth.typings";
import { AuthorizationUtils } from "../../../shared/utils/authorization.utils";
import { ApiHitsBaseRepo } from "../../processor/repos/apiHitsBase.repo";
import { ApiHitsWithId } from "../../../shared/infra/db/mongo/models/apiHits.model";
import { EndPointMetricsBaseRepo } from "../../processor/repos/endpointMetricsBase.repo";
import { IAnalyticsService } from "../contracts/IAnalyticsService.contract";
import {
   AnalyticsTimeRangeQueryDTOType,
   AnalyticsTimeSeriesQueryDTOType,
   EndpointDrilldownQueryDTOType,
   ExportQueryDTOType,
   RawLogsQueryDTOType,
   ServicesQueryDTOType,
} from "../dtos/analyticsQuery.dto";
import { EndpointSummary, OverviewStats, RawLogsPage, TimeSeriesBucket } from "../dtos/analyticsResponse.dto";

export class AnalyticsService implements IAnalyticsService {
   private endPointMetricsRepo: EndPointMetricsBaseRepo<EndpointMetrics>;
   private apiHitsRepo: ApiHitsBaseRepo<ApiHitsWithId>;

   constructor(endPointMetricsRepo: EndPointMetricsBaseRepo<EndpointMetrics>, apiHitsRepo: ApiHitsBaseRepo<ApiHitsWithId>) {
      if (!endPointMetricsRepo) {
         throw new ResourceNotInitializedError(
            "[AnalyticsService] EndpointMetrics repository must be provided to AnalyticsService",
         );
      }
      if (!apiHitsRepo) {
         throw new ResourceNotInitializedError("[AnalyticsService] ApiHits repository must be provided to AnalyticsService");
      }
      this.endPointMetricsRepo = endPointMetricsRepo;
      this.apiHitsRepo = apiHitsRepo;
   }

   private mapToEndpointSummary(rows: EndpointMetrics[]): EndpointSummary[] {
      return rows.map((row) => {
         // Postgres SUM()/MIN()/MAX() on integer columns come back as strings
         // over the wire (bigint safety) — coerce before doing arithmetic or
         // handing them to the frontend as JSON numbers.
         const totalHits = Number(row.total_hits);
         const errorHits = Number(row.error_hits);
         const totalLatency = Number(row.total_latency);
         const minLatency = Number(row.min_latency);
         const maxLatency = Number(row.max_latency);
         const avgLatency = totalHits > 0 ? parseFloat((totalLatency / totalHits).toFixed(2)) : 0;
         const errorRate = totalHits > 0 ? parseFloat(((errorHits / totalHits) * 100).toFixed(2)) : 0;
         return {
            service_name: row.service_name,
            endpoint: row.endpoint,
            method: row.method,
            total_hits: totalHits,
            error_hits: errorHits,
            error_rate: errorRate,
            avg_latency: avgLatency,
            min_latency: minLatency,
            max_latency: maxLatency,
         };
      });
   }

   async getOverview(
      user: UserInsideAuthorizedRequest,
      clientId: string,
      startTime?: Date,
      endTime?: Date,
   ): Promise<OverviewStats> {
      try {
         AuthorizationUtils.canViewAnalytics(user, clientId);
         logger.info(`[AnalyticsService] Fetching overview stats for clientId: ${clientId}`);
         return await this.endPointMetricsRepo.getOverviewStats(clientId, startTime, endTime);
      } catch (error) {
         logger.error("[AnalyticsService] Error fetching overview stats", { error, clientId });
         throw error;
      }
   }

   async getTopEndpointsByHits(
      user: UserInsideAuthorizedRequest,
      query: AnalyticsTimeRangeQueryDTOType,
   ): Promise<EndpointSummary[]> {
      try {
         AuthorizationUtils.canViewAnalytics(user, query.clientId);
         logger.info(`[AnalyticsService] Fetching top endpoints by hits for clientId: ${query.clientId}`);
         const rows = await this.endPointMetricsRepo.getTopEndpointsByTotalHits(
            query.limit,
            query.startTime,
            query.endTime,
            query.clientId,
         );
         return this.mapToEndpointSummary(rows);
      } catch (error) {
         logger.error("[AnalyticsService] Error fetching top endpoints by hits", { error, query });
         throw error;
      }
   }

   async getTopEndpointsByErrors(
      user: UserInsideAuthorizedRequest,
      query: AnalyticsTimeRangeQueryDTOType,
   ): Promise<EndpointSummary[]> {
      try {
         AuthorizationUtils.canViewAnalytics(user, query.clientId);
         logger.info(`[AnalyticsService] Fetching top endpoints by errors for clientId: ${query.clientId}`);
         const rows = await this.endPointMetricsRepo.getTopEndpointsByErrorHits(
            query.limit,
            query.startTime,
            query.endTime,
            query.clientId,
         );
         return this.mapToEndpointSummary(rows);
      } catch (error) {
         logger.error("[AnalyticsService] Error fetching top endpoints by errors", { error, query });
         throw error;
      }
   }

   async getTopEndpointsByLatency(
      user: UserInsideAuthorizedRequest,
      query: AnalyticsTimeRangeQueryDTOType,
   ): Promise<EndpointSummary[]> {
      try {
         AuthorizationUtils.canViewAnalytics(user, query.clientId);
         logger.info(`[AnalyticsService] Fetching top endpoints by latency for clientId: ${query.clientId}`);
         const rows = await this.endPointMetricsRepo.getTopEndpointsByAverageLatency(
            query.limit,
            query.startTime,
            query.endTime,
            query.clientId,
         );
         return this.mapToEndpointSummary(rows);
      } catch (error) {
         logger.error("[AnalyticsService] Error fetching top endpoints by latency", { error, query });
         throw error;
      }
   }

   /** Picks time-series source/resolution by range. */
   private pickGranularity(startTime: Date, endTime: Date): { bucketMs: number; source: "mongo-fine" | "postgres-hourly" | "postgres-daily" } {
      const HOUR_MS = 60 * 60 * 1000;
      const DAY_MS = 24 * HOUR_MS;
      const spanMs = Math.max(0, endTime.getTime() - startTime.getTime());

      if (spanMs <= 3 * HOUR_MS) {
         const MINUTE_MS = 60 * 1000;
         // Aim for ~60 points across the range, snapped to a whole minute.
         const bucketMs = Math.max(MINUTE_MS, Math.round(spanMs / 60 / MINUTE_MS) * MINUTE_MS);
         return { bucketMs, source: "mongo-fine" };
      }
      if (spanMs > 10 * DAY_MS) {
         return { bucketMs: DAY_MS, source: "postgres-daily" };
      }
      return { bucketMs: HOUR_MS, source: "postgres-hourly" };
   }

   async getTimeSeries(user: UserInsideAuthorizedRequest, query: AnalyticsTimeSeriesQueryDTOType): Promise<TimeSeriesBucket[]> {
      try {
         AuthorizationUtils.canViewAnalytics(user, query.clientId);
         logger.info(`[AnalyticsService] Fetching time series for clientId: ${query.clientId}`);

         const endTime = query.endTime ?? new Date();
         const startTime = query.startTime ?? new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
         const { bucketMs, source } = this.pickGranularity(startTime, endTime);

         if (source === "mongo-fine") {
            return await this.apiHitsRepo.getFineTimeSeries(query.clientId, bucketMs, startTime, endTime, query.serviceName);
         }
         if (source === "postgres-daily") {
            return await this.endPointMetricsRepo.getDailyTimeSeries(query.clientId, startTime, endTime, query.serviceName);
         }
         return await this.endPointMetricsRepo.getTimeSeries(query.clientId, startTime, endTime, query.serviceName);
      } catch (error) {
         logger.error("[AnalyticsService] Error fetching time series", { error, query });
         throw error;
      }
   }

   async getRawLogs(user: UserInsideAuthorizedRequest, query: RawLogsQueryDTOType): Promise<RawLogsPage> {
      try {
         AuthorizationUtils.canViewRawLogs(user, query.clientId);
         logger.info(`[AnalyticsService] Fetching raw logs for clientId: ${query.clientId}`);
         return await this.apiHitsRepo.findRawLogs(query);
      } catch (error) {
         logger.error("[AnalyticsService] Error fetching raw logs", { error, query });
         throw error;
      }
   }

   async getEndpointDrilldown(
      user: UserInsideAuthorizedRequest,
      query: EndpointDrilldownQueryDTOType,
   ): Promise<TimeSeriesBucket[]> {
      try {
         AuthorizationUtils.canViewRawLogs(user, query.clientId);
         logger.info(
            `[AnalyticsService] Fetching endpoint drilldown for clientId: ${query.clientId} endpoint: ${query.endpoint}`,
         );

         const endTime = query.endTime ?? new Date();
         const startTime = query.startTime ?? new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
         const { bucketMs } = this.pickGranularity(startTime, endTime);

         return await this.apiHitsRepo.getEndpointTimeSeries(
            query.clientId,
            query.serviceName,
            query.endpoint,
            query.method,
            startTime,
            endTime,
            bucketMs,
         );
      } catch (error) {
         logger.error("[AnalyticsService] Error fetching endpoint drilldown", { error, query });
         throw error;
      }
   }

   async getServices(user: UserInsideAuthorizedRequest, query: ServicesQueryDTOType): Promise<string[]> {
      try {
         AuthorizationUtils.canViewAnalytics(user, query.clientId);
         logger.info(`[AnalyticsService] Fetching distinct services for clientId: ${query.clientId}`);
         return await this.apiHitsRepo.getDistinctServices(query.clientId);
      } catch (error) {
         logger.error("[AnalyticsService] Error fetching distinct services", { error, query });
         throw error;
      }
   }

   async exportLogs(
      user: UserInsideAuthorizedRequest,
      query: ExportQueryDTOType,
      onRow: (csvRow: string) => void,
   ): Promise<void> {
      try {
         AuthorizationUtils.canExportData(user, query.clientId);
         logger.info(`[AnalyticsService] Exporting logs as CSV for clientId: ${query.clientId}`);
         await this.apiHitsRepo.streamRawLogsAsCsv(query, onRow);
      } catch (error) {
         logger.error("[AnalyticsService] Error exporting logs", { error, query });
         throw error;
      }
   }
}
