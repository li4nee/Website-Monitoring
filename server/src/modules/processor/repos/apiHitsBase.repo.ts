import { EventDataType } from "../../../shared/typings/messaging.typings";
import { RawLogsPage } from "../../../modules/analytics/dtos/analyticsResponse.dto";
import { ExportQueryDTOType, RawLogsQueryDTOType } from "../../../modules/analytics/dtos/analyticsQuery.dto";
import { TimeSeriesBucket } from "../../../modules/analytics/dtos/analyticsResponse.dto";

/**
 * Base repository for Api Hits, defining the contract for data access operations.
 */
export abstract class ApiHitsBaseRepo<T> {
   abstract createApiHit(eventData: EventDataType): Promise<T>;
   abstract findWithFilters(
      filters: Partial<T>,
      limit: number,
      offset?: number,
      sortBy?: string,
      sortOrder?: "ASC" | "DESC",
   ): Promise<T[]>;
   abstract countApiHitsByClientId(clientId: string): Promise<number>;
   abstract deleteOldApiHits(olderThan: Date): Promise<void>;
   abstract findRawLogs(query: RawLogsQueryDTOType): Promise<RawLogsPage>;
   abstract getEndpointTimeSeries(
      clientId: string,
      serviceName: string,
      endpoint: string,
      method: string,
      startTime?: Date,
      endTime?: Date,
   ): Promise<TimeSeriesBucket[]>;
   abstract getDistinctServices(clientId: string): Promise<string[]>;
   abstract streamRawLogsAsCsv(query: ExportQueryDTOType, onRow: (csvRow: string) => void): Promise<void>;
}
