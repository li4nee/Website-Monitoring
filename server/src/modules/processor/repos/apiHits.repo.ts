import { Types } from "mongoose";
import logger from "../../../shared/config/logger.config";
import { ApiHitModel, ApiHitsWithId } from "../../../shared/infra/db/mongo/models/apiHits.model";
import { EventDataType } from "../../../shared/typings/messaging.typings";
import { ExportQueryDTOType, RawLogsQueryDTOType } from "../../../modules/analytics/dtos/analyticsQuery.dto";
import { RawLogEntry, RawLogsPage, TimeSeriesBucket } from "../../../modules/analytics/dtos/analyticsResponse.dto";
import { ApiHitsBaseRepo } from "./apiHitsBase.repo";

export class MongoApiHitsRepo extends ApiHitsBaseRepo<ApiHitsWithId> {
   private model = ApiHitModel;

   async createApiHit(apiHitData: EventDataType, retentionDays: number): Promise<ApiHitsWithId> {
      try {
         const timestamp = new Date(apiHitData.timeStamp);
         const expiresAt = new Date(timestamp.getTime() + retentionDays * 24 * 60 * 60 * 1000);
         const doc = new this.model({
            eventId: apiHitData.eventId,
            timestamp,
            expiresAt,
            serviceName: apiHitData.serviceName,
            endPoint: apiHitData.endpoint,
            method: apiHitData.method,
            statusCode: apiHitData.statusCode,
            latencyInMs: apiHitData.latencyMs,
            ipV4: apiHitData.ipInIpV4,
            ipV6: apiHitData.ipInIpV6,
            userAgent: apiHitData.userAgent,
            clientId: new Types.ObjectId(apiHitData.clientId),
            apiKeyId: new Types.ObjectId(apiHitData.apiKeyId),
            createdAt: new Date(),
         });
         const result = await doc.save();
         return result.toObject();
      } catch (error) {
         logger.error(`Failed to create API hit: ${error instanceof Error ? error.message : "Unknown error"}`);
         throw error;
      }
   }

   async findWithFilters(
      filters: Partial<ApiHitsWithId>,
      limit: number,
      offset: number = 0,
      sortBy: string = "timestamp",
      sortOrder: "ASC" | "DESC" = "DESC",
   ): Promise<ApiHitsWithId[]> {
      try {
         const sortOption: Record<string, 1 | -1> = {};
         sortOption[sortBy] = sortOrder === "ASC" ? 1 : -1;

         const apiHits = await this.model.find(filters).sort(sortOption).skip(offset).limit(limit).lean().exec();

         return apiHits;
      } catch (e) {
         logger.error(`Failed to find API hits with filters: ${e instanceof Error ? e.message : "Unknown error"}`);
         throw e;
      }
   }

   async countApiHitsByClientId(clientId: string): Promise<number> {
      try {
         const count = await this.model.countDocuments({ clientId });
         return count;
      } catch (error) {
         logger.error(`Failed to count API hits by client ID: ${error instanceof Error ? error.message : "Unknown error"}`);
         throw error;
      }
   }

   async deleteOldApiHits(olderThan: Date): Promise<void> {
      try {
         await this.model.deleteMany({ createdAt: { $lt: olderThan } });
      } catch (error) {
         logger.error(`Failed to delete old API hits: ${error instanceof Error ? error.message : "Unknown error"}`);
         throw error;
      }
   }

   async findRawLogs(query: RawLogsQueryDTOType): Promise<RawLogsPage> {
      try {
         const filter: Record<string, any> = {
            clientId: new Types.ObjectId(query.clientId),
         };

         if (query.serviceName) filter.serviceName = query.serviceName;
         if (query.endpoint) filter.endPoint = query.endpoint;
         if (query.method) filter.method = query.method;
         if (query.statusCode !== undefined) filter.statusCode = query.statusCode;

         const timeFilter: Record<string, Date> = {};
         if (query.startTime) timeFilter.$gte = query.startTime;
         if (query.endTime) timeFilter.$lte = query.endTime;
         if (Object.keys(timeFilter).length > 0) filter.timestamp = timeFilter;

         // Cursor is the _id of the last document from the previous page.
         if (query.cursor) {
            filter._id = { $lt: new Types.ObjectId(query.cursor) };
         }

         const safeLimit = Math.min(Math.max(query.limit, 1), 200);

         const docs = await this.model
            .find(filter)
            .sort({ _id: -1 })
            .limit(safeLimit)
            .select("eventId timestamp serviceName endPoint method statusCode latencyInMs ipV4 ipV6 userAgent")
            .lean()
            .exec();

         const logs: RawLogEntry[] = docs.map((doc) => ({
            eventId: doc.eventId,
            timestamp: doc.timestamp,
            serviceName: doc.serviceName,
            endpoint: doc.endPoint,
            method: doc.method,
            statusCode: doc.statusCode,
            latencyInMs: doc.latencyInMs,
            ipV4: doc.ipV4 ?? undefined,
            ipV6: doc.ipV6 ?? undefined,
            userAgent: doc.userAgent ?? undefined,
         }));

         const nextCursor = docs.length === safeLimit ? docs[docs.length - 1]._id.toString() : null;

         return { logs, nextCursor };
      } catch (error) {
         logger.error(`Failed to find raw logs: ${error instanceof Error ? error.message : "Unknown error"}`);
         throw error;
      }
   }

   async getEndpointTimeSeries(
      clientId: string,
      serviceName: string,
      endpoint: string,
      method: string,
      startTime?: Date,
      endTime?: Date,
   ): Promise<TimeSeriesBucket[]> {
      try {
         const matchStage: Record<string, any> = {
            clientId: new Types.ObjectId(clientId),
            serviceName,
            endPoint: endpoint,
            method,
         };

         const timeFilter: Record<string, Date> = {};
         if (startTime) timeFilter.$gte = startTime;
         if (endTime) timeFilter.$lte = endTime;
         if (Object.keys(timeFilter).length > 0) matchStage.timestamp = timeFilter;

         const results = await this.model.aggregate([
            { $match: matchStage },
            {
               $group: {
                  _id: {
                     $dateToString: {
                        format: "%Y-%m-%dT%H:00:00.000Z",
                        date: "$timestamp",
                     },
                  },
                  total_hits: { $sum: 1 },
                  error_hits: { $sum: { $cond: [{ $gte: ["$statusCode", 400] }, 1, 0] } },
                  total_latency: { $sum: "$latencyInMs" },
               },
            },
            { $sort: { _id: 1 } },
         ]);

         return results.map((r) => ({
            time_bucket: new Date(r._id),
            total_hits: r.total_hits,
            error_hits: r.error_hits,
            avg_latency: r.total_hits > 0 ? parseFloat((r.total_latency / r.total_hits).toFixed(2)) : 0,
         }));
      } catch (error) {
         logger.error(`Failed to get endpoint time series: ${error instanceof Error ? error.message : "Unknown error"}`);
         throw error;
      }
   }

   async getDistinctServices(clientId: string): Promise<string[]> {
      try {
         const services = await this.model.distinct("serviceName", {
            clientId: new Types.ObjectId(clientId),
         });
         return services.sort();
      } catch (error) {
         logger.error(`Failed to get distinct services: ${error instanceof Error ? error.message : "Unknown error"}`);
         throw error;
      }
   }

   async streamRawLogsAsCsv(query: ExportQueryDTOType, onRow: (csvRow: string) => void): Promise<void> {
      try {
         const filter: Record<string, any> = {
            clientId: new Types.ObjectId(query.clientId),
         };

         if (query.serviceName) filter.serviceName = query.serviceName;
         if (query.endpoint) filter.endPoint = query.endpoint;
         if (query.method) filter.method = query.method;
         if (query.statusCode !== undefined) filter.statusCode = query.statusCode;

         const timeFilter: Record<string, Date> = {};
         if (query.startTime) timeFilter.$gte = query.startTime;
         if (query.endTime) timeFilter.$lte = query.endTime;
         if (Object.keys(timeFilter).length > 0) filter.timestamp = timeFilter;

         const cursor = this.model
            .find(filter)
            .sort({ timestamp: -1 })
            .select("eventId timestamp serviceName endPoint method statusCode latencyInMs ipV4 ipV6 userAgent")
            .lean()
            .cursor();

         for await (const doc of cursor) {
            const row = [
               doc.eventId,
               doc.timestamp.toISOString(),
               doc.serviceName,
               doc.endPoint,
               doc.method,
               doc.statusCode,
               doc.latencyInMs,
               doc.ipV4 ?? "",
               doc.ipV6 ?? "",
               `"${(doc.userAgent ?? "").replace(/"/g, '""')}"`,
            ].join(",");
            onRow(row);
         }
      } catch (error) {
         logger.error(`Failed to stream raw logs as CSV: ${error instanceof Error ? error.message : "Unknown error"}`);
         throw error;
      }
   }
}
