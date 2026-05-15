import { Types } from "mongoose";
import logger from "../../../shared/config/logger.config";
import { AlertFireLogDocument, AlertFireLogModel } from "../../../shared/infra/db/mongo/models/alertFireLog.model";
import { AlertFireLogBaseRepo } from "./alertFireLogBase.repo";

export class MongoAlertFireLogRepo extends AlertFireLogBaseRepo<AlertFireLogDocument> {
   private model = AlertFireLogModel;

   async create(data: Record<string, any>): Promise<AlertFireLogDocument> {
      try {
         const log = await this.model.create(data);
         logger.info(`[MongoAlertFireLogRepo] Fire log created for alert: ${log.alertId}`);
         return log;
      } catch (error) {
         logger.error("[MongoAlertFireLogRepo] Error creating fire log", { error, data });
         throw error;
      }
   }

   async findByAlertId(
      alertId: string,
      limit: number = 20,
      cursor?: string,
   ): Promise<{ data: AlertFireLogDocument[]; nextCursor?: string }> {
      try {
         const filter: Record<string, any> = { alertId: new Types.ObjectId(alertId) };

         if (cursor) {
            filter._id = { $lt: new Types.ObjectId(cursor) };
         }

         const safeLimit = Math.min(Math.max(limit, 1), 100);
         const items = await this.model
            .find(filter)
            .sort({ _id: -1 })
            .limit(safeLimit + 1);

         let nextCursor: string | undefined;
         let data: AlertFireLogDocument[];

         if (items.length > safeLimit) {
            nextCursor = items[safeLimit]._id.toString();
            data = items.slice(0, safeLimit);
         } else {
            data = items;
         }

         return { data, nextCursor };
      } catch (error) {
         logger.error(`[MongoAlertFireLogRepo] Error finding fire logs for alertId: ${alertId}`, { error });
         throw error;
      }
   }

   async findLastFireForAlert(alertId: string): Promise<AlertFireLogDocument | null> {
      try {
         return await this.model
            .findOne({ alertId: new Types.ObjectId(alertId) })
            .sort({ firedAt: -1 });
      } catch (error) {
         logger.error(`[MongoAlertFireLogRepo] Error finding last fire for alertId: ${alertId}`, { error });
         throw error;
      }
   }

   async deleteByAlertId(alertId: string): Promise<void> {
      try {
         await this.model.deleteMany({ alertId: new Types.ObjectId(alertId) });
         logger.info(`[MongoAlertFireLogRepo] Fire logs deleted for alertId: ${alertId}`);
      } catch (error) {
         logger.error(`[MongoAlertFireLogRepo] Error deleting fire logs for alertId: ${alertId}`, { error });
         throw error;
      }
   }
}
