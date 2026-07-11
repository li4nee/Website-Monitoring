import { OverviewStats, TimeSeriesBucket } from "../../../modules/analytics/dtos/analyticsResponse.dto";

export abstract class EndPointMetricsBaseRepo<T> {
   abstract upsertEndpointMetrics(metrixData: T): Promise<void>;

   abstract findWithFilters(
      filters: Partial<T>,
      limit: number,
      offset?: number,
      sortBy?: string,
      sortOrder?: "ASC" | "DESC",
   ): Promise<T[]>;

   abstract getTopEndpointsByTotalHits(limit: number, startTime?: Date, endTime?: Date, clientId?: string): Promise<T[]>;

   abstract getTopEndpointsByErrorHits(limit: number, startTime?: Date, endTime?: Date, clientId?: string): Promise<T[]>;

   abstract getTopEndpointsByTotalLatency(limit: number, startTime?: Date, endTime?: Date, clientId?: string): Promise<T[]>;

   abstract getTopEndpointsByAverageLatency(limit: number, startTime?: Date, endTime?: Date, clientId?: string): Promise<T[]>;

   abstract getOverviewStats(clientId: string, startTime?: Date, endTime?: Date): Promise<OverviewStats>;

   abstract getTimeSeries(clientId: string, startTime?: Date, endTime?: Date, serviceName?: string): Promise<TimeSeriesBucket[]>;

   /** Same rollup table as getTimeSeries, but grouped by day instead of the
    * stored hourly bucket — used for long ranges where hundreds of hourly
    * points would just be noise rather than a readable trend. */
   abstract getDailyTimeSeries(clientId: string, startTime?: Date, endTime?: Date, serviceName?: string): Promise<TimeSeriesBucket[]>;
}
