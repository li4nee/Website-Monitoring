import { Types } from "mongoose";
import logger from "../../../shared/config/logger.config";
import { ApiHitModel, ApiHitsWithId } from "../../../shared/infra/db/mongo/models/apiHits.model";
import { EventDataType } from "../../../shared/typings/messaging.typings";
import { ApiHitsBaseRepo } from "./apiHitsBase.repo";

export class MongoApiHitsRepo extends ApiHitsBaseRepo<ApiHitsWithId> {
   private model = ApiHitModel;

   async createApiHit(apiHitData: EventDataType): Promise<ApiHitsWithId> {
      try {
         const doc = new this.model({
            eventId: apiHitData.eventId,
            timestamp: new Date(apiHitData.timeStamp),
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
}
