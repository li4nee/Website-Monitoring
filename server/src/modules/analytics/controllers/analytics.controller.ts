import type { Response, NextFunction } from "express";
import { AuthorizedRequest } from "../../../shared/typings/auth.typings";
import { ResourceNotInitializedError } from "../../../shared/typings/error.typings";
import { ResponseFormatter } from "../../../shared/utils/responseFormatter.utils";
import { IAnalyticsService } from "../contracts/IAnalyticsService.contract";
import {
   AnalyticsTimeRangeQueryDTOType,
   AnalyticsTimeSeriesQueryDTOType,
   EndpointDrilldownQueryDTOType,
   ExportQueryDTOType,
   RawLogsQueryDTOType,
   ServicesQueryDTOType,
} from "../dtos/analyticsQuery.dto";

export class AnalyticsController {
   protected analyticsService: IAnalyticsService;

   constructor(analyticsService: IAnalyticsService) {
      if (!analyticsService) {
         throw new ResourceNotInitializedError("[AnalyticsController] AnalyticsService must be provided to AnalyticsController");
      }
      this.analyticsService = analyticsService;
   }

   /**
    * GET /api/v1/analytics/overview?clientId=&startTime=&endTime=
    */
   async getOverview(req: AuthorizedRequest, res: Response, next: NextFunction) {
      try {
         const { clientId, startTime, endTime } = req.query as AnalyticsTimeSeriesQueryDTOType;
         const start = startTime ? new Date(startTime) : undefined;
         const end = endTime ? new Date(endTime) : undefined;
         const stats = await this.analyticsService.getOverview(req.user!, clientId, start, end);
         return res.status(200).json(ResponseFormatter.success("Overview stats retrieved successfully.", 200, { stats }));
      } catch (error) {
         next(error);
      }
   }

   /**
    * GET /api/v1/analytics/top/hits?clientId=&startTime=&endTime=&limit=
    */
   async getTopEndpointsByHits(req: AuthorizedRequest, res: Response, next: NextFunction) {
      try {
         const query = req.query as unknown as AnalyticsTimeRangeQueryDTOType;
         const endpoints = await this.analyticsService.getTopEndpointsByHits(req.user!, query);
         return res
            .status(200)
            .json(ResponseFormatter.success("Top endpoints by hits retrieved successfully.", 200, { endpoints }));
      } catch (error) {
         next(error);
      }
   }

   /**
    * GET /api/v1/analytics/top/errors?clientId=&startTime=&endTime=&limit=
    */
   async getTopEndpointsByErrors(req: AuthorizedRequest, res: Response, next: NextFunction) {
      try {
         const query = req.query as unknown as AnalyticsTimeRangeQueryDTOType;
         const endpoints = await this.analyticsService.getTopEndpointsByErrors(req.user!, query);
         return res
            .status(200)
            .json(ResponseFormatter.success("Top endpoints by errors retrieved successfully.", 200, { endpoints }));
      } catch (error) {
         next(error);
      }
   }

   /**
    * GET /api/v1/analytics/top/latency?clientId=&startTime=&endTime=&limit=
    */
   async getTopEndpointsByLatency(req: AuthorizedRequest, res: Response, next: NextFunction) {
      try {
         const query = req.query as unknown as AnalyticsTimeRangeQueryDTOType;
         const endpoints = await this.analyticsService.getTopEndpointsByLatency(req.user!, query);
         return res
            .status(200)
            .json(ResponseFormatter.success("Top endpoints by latency retrieved successfully.", 200, { endpoints }));
      } catch (error) {
         next(error);
      }
   }

   /**
    * GET /api/v1/analytics/timeseries?clientId=&startTime=&endTime=&serviceName=
    */
   async getTimeSeries(req: AuthorizedRequest, res: Response, next: NextFunction) {
      try {
         const query = req.query as unknown as AnalyticsTimeSeriesQueryDTOType;
         const buckets = await this.analyticsService.getTimeSeries(req.user!, query);
         return res.status(200).json(ResponseFormatter.success("Time series data retrieved successfully.", 200, { buckets }));
      } catch (error) {
         next(error);
      }
   }

   /**
    * GET /api/v1/analytics/logs?clientId=&serviceName=&endpoint=&method=&statusCode=&startTime=&endTime=&limit=&cursor=
    */
   async getRawLogs(req: AuthorizedRequest, res: Response, next: NextFunction) {
      try {
         const query = req.query as unknown as RawLogsQueryDTOType;
         const result = await this.analyticsService.getRawLogs(req.user!, query);
         return res.status(200).json(ResponseFormatter.success("Raw logs retrieved successfully.", 200, result));
      } catch (error) {
         next(error);
      }
   }

   /**
    * GET /api/v1/analytics/endpoint?clientId=&serviceName=&endpoint=&method=&startTime=&endTime=
    */
   async getEndpointDrilldown(req: AuthorizedRequest, res: Response, next: NextFunction) {
      try {
         const query = req.query as unknown as EndpointDrilldownQueryDTOType;
         const buckets = await this.analyticsService.getEndpointDrilldown(req.user!, query);
         return res.status(200).json(ResponseFormatter.success("Endpoint drilldown retrieved successfully.", 200, { buckets }));
      } catch (error) {
         next(error);
      }
   }

   /**
    * GET /api/v1/analytics/services?clientId=
    */
   async getServices(req: AuthorizedRequest, res: Response, next: NextFunction) {
      try {
         const query = req.query as unknown as ServicesQueryDTOType;
         const services = await this.analyticsService.getServices(req.user!, query);
         return res.status(200).json(ResponseFormatter.success("Services retrieved successfully.", 200, { services }));
      } catch (error) {
         next(error);
      }
   }

   /**
    * GET /api/v1/analytics/export?clientId=&serviceName=&endpoint=&method=&statusCode=&startTime=&endTime=
    */
   async exportLogs(req: AuthorizedRequest, res: Response, next: NextFunction) {
      try {
         const query = req.query as unknown as ExportQueryDTOType;
         const filename = `logs-${query.clientId}-${Date.now()}.csv`;
         res.setHeader("Content-Type", "text/csv");
         res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
         res.write("eventId,timestamp,serviceName,endpoint,method,statusCode,latencyInMs,ipV4,ipV6,userAgent\n");
         await this.analyticsService.exportLogs(req.user!, query, (csvRow) => res.write(csvRow + "\n"));
         res.end();
      } catch (error) {
         next(error);
      }
   }
}
