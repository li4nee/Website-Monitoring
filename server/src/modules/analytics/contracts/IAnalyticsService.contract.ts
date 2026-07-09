import { UserInsideAuthorizedRequest } from "../../../shared/typings/auth.typings";
import {
   AnalyticsTimeRangeQueryDTOType,
   AnalyticsTimeSeriesQueryDTOType,
   EndpointDrilldownQueryDTOType,
   ExportQueryDTOType,
   RawLogsQueryDTOType,
   ServicesQueryDTOType,
} from "../dtos/analyticsQuery.dto";
import { EndpointSummary, OverviewStats, RawLogsPage, TimeSeriesBucket } from "../dtos/analyticsResponse.dto";

export interface IAnalyticsService {
   getOverview(user: UserInsideAuthorizedRequest, clientId: string, startTime?: Date, endTime?: Date): Promise<OverviewStats>;
   getTopEndpointsByHits(user: UserInsideAuthorizedRequest, query: AnalyticsTimeRangeQueryDTOType): Promise<EndpointSummary[]>;
   getTopEndpointsByErrors(user: UserInsideAuthorizedRequest, query: AnalyticsTimeRangeQueryDTOType): Promise<EndpointSummary[]>;
   getTopEndpointsByLatency(user: UserInsideAuthorizedRequest, query: AnalyticsTimeRangeQueryDTOType): Promise<EndpointSummary[]>;
   getTimeSeries(user: UserInsideAuthorizedRequest, query: AnalyticsTimeSeriesQueryDTOType): Promise<TimeSeriesBucket[]>;
   getRawLogs(user: UserInsideAuthorizedRequest, query: RawLogsQueryDTOType): Promise<RawLogsPage>;
   getEndpointDrilldown(user: UserInsideAuthorizedRequest, query: EndpointDrilldownQueryDTOType): Promise<TimeSeriesBucket[]>;
   getServices(user: UserInsideAuthorizedRequest, query: ServicesQueryDTOType): Promise<string[]>;
   exportLogs(user: UserInsideAuthorizedRequest, query: ExportQueryDTOType, onRow: (csvRow: string) => void): Promise<void>;
}
