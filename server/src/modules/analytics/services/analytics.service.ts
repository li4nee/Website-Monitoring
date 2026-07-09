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
         const avgLatency = row.total_hits > 0 ? parseFloat((row.total_latency / row.total_hits).toFixed(2)) : 0;
         const errorRate = row.total_hits > 0 ? parseFloat(((row.error_hits / row.total_hits) * 100).toFixed(2)) : 0;
         return {
            service_name: row.service_name,
            endpoint: row.endpoint,
            method: row.method,
            total_hits: row.total_hits,
            error_hits: row.error_hits,
            error_rate: errorRate,
            avg_latency: avgLatency,
            min_latency: row.min_latency,
            max_latency: row.max_latency,
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

   async getTimeSeries(user: UserInsideAuthorizedRequest, query: AnalyticsTimeSeriesQueryDTOType): Promise<TimeSeriesBucket[]> {
      try {
         AuthorizationUtils.canViewAnalytics(user, query.clientId);
         logger.info(`[AnalyticsService] Fetching time series for clientId: ${query.clientId}`);
         return await this.endPointMetricsRepo.getTimeSeries(query.clientId, query.startTime, query.endTime, query.serviceName);
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
         return await this.apiHitsRepo.getEndpointTimeSeries(
            query.clientId,
            query.serviceName,
            query.endpoint,
            query.method,
            query.startTime,
            query.endTime,
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
