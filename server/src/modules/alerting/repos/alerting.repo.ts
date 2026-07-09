import { Types } from "mongoose";
import logger from "../../../shared/config/logger.config";
import { AlertingDocument, AlertingModel } from "../../../shared/infra/db/mongo/models/alerting.model";
import { AlertingBaseRepo } from "./alertingBase.repo";

export class MongoAlertingRepo extends AlertingBaseRepo<AlertingDocument> {
   private model = AlertingModel;

   async create(data: Record<string, any>): Promise<AlertingDocument> {
      try {
         const alert = await this.model.create(data);
         logger.info(`[MongoAlertingRepo] Alert created: ${alert._id}`);
         return alert;
      } catch (error) {
         logger.error("[MongoAlertingRepo] Error creating alert", { error, data });
         throw error;
      }
   }

   async findById(id: string): Promise<AlertingDocument | null> {
      try {
         return await this.model.findById(id).select("-__v");
      } catch (error) {
         logger.error(`[MongoAlertingRepo] Error finding alert by id: ${id}`, { error });
         throw error;
      }
   }

   async findByClientId(
      clientId: string,
      limit: number = 20,
      cursor?: string,
   ): Promise<{ data: AlertingDocument[]; nextCursor?: string }> {
      try {
         const filter: Record<string, any> = { clientId: new Types.ObjectId(clientId) };

         if (cursor) {
            filter._id = { $lt: new Types.ObjectId(cursor) };
         }

         const safeLimit = Math.min(Math.max(limit, 1), 100);
         const items = await this.model
            .find(filter)
            .sort({ _id: -1 })
            .limit(safeLimit + 1)
            .select("-__v");

         let nextCursor: string | undefined;
         let data: AlertingDocument[];

         if (items.length > safeLimit) {
            nextCursor = items[safeLimit]._id.toString();
            data = items.slice(0, safeLimit);
         } else {
            data = items;
         }

         return { data, nextCursor };
      } catch (error) {
         logger.error(`[MongoAlertingRepo] Error finding alerts for clientId: ${clientId}`, { error });
         throw error;
      }
   }

   async findEnabled(limit: number = 100, cursor?: string): Promise<{ data: AlertingDocument[]; nextCursor?: string }> {
      try {
         const filter: Record<string, any> = { isEnabled: true };

         if (cursor) {
            filter._id = { $lt: new Types.ObjectId(cursor) };
         }

         const safeLimit = Math.min(Math.max(limit, 1), 100);
         const items = await this.model
            .find(filter)
            .sort({ _id: -1 })
            .limit(safeLimit + 1)
            .select("-__v");

         let nextCursor: string | undefined;
         let data: AlertingDocument[];

         if (items.length > safeLimit) {
            nextCursor = items[safeLimit]._id.toString();
            data = items.slice(0, safeLimit);
         } else {
            data = items;
         }

         return { data, nextCursor };
      } catch (error) {
         logger.error("[MongoAlertingRepo] Error finding enabled alerts", { error });
         throw error;
      }
   }

   async update(id: string, data: Record<string, any>): Promise<AlertingDocument | null> {
      try {
         const updated = await this.model.findByIdAndUpdate(id, { $set: data }, { new: true }).select("-__v");
         if (!updated) logger.warn(`[MongoAlertingRepo] Alert not found for update: ${id}`);
         return updated;
      } catch (error) {
         logger.error(`[MongoAlertingRepo] Error updating alert: ${id}`, { error, data });
         throw error;
      }
   }

   async delete(id: string): Promise<void> {
      try {
         await this.model.findByIdAndDelete(id);
         logger.info(`[MongoAlertingRepo] Alert deleted: ${id}`);
      } catch (error) {
         logger.error(`[MongoAlertingRepo] Error deleting alert: ${id}`, { error });
         throw error;
      }
   }

   async setEnabled(id: string, isEnabled: boolean): Promise<AlertingDocument | null> {
      try {
         const updated = await this.model.findByIdAndUpdate(id, { $set: { isEnabled } }, { new: true }).select("-__v");
         if (!updated) logger.warn(`[MongoAlertingRepo] Alert not found for enable/disable: ${id}`);
         return updated;
      } catch (error) {
         logger.error(`[MongoAlertingRepo] Error setting enabled status for alert: ${id}`, { error });
         throw error;
      }
   }
}
