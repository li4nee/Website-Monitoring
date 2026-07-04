import { Types } from "mongoose";
import logger from "../../../shared/config/logger.config";
import { AuditLogModel, AuditLogWithId } from "../../../shared/infra/db/mongo/models/auditLog.model";
import { AuditLogBaseRepo } from "./auditLogBase.repo";

export class MongoAuditLogRepo extends AuditLogBaseRepo<AuditLogWithId> {
   private model = AuditLogModel;

   async findByClientId(
      clientId: string,
      limit: number = 20,
      cursor?: string,
   ): Promise<{ data: AuditLogWithId[]; nextCursor?: string }> {
      try {
         const filter: Record<string, any> = { clientId: new Types.ObjectId(clientId) };

         if (cursor) {
            filter._id = { $lt: new Types.ObjectId(cursor) };
         }

         const safeLimit = Math.min(Math.max(limit, 1), 100);
         const docs = await this.model
            .find(filter)
            .sort({ _id: -1 })
            .limit(safeLimit + 1)
            .lean();

         let nextCursor: string | undefined;
         let data: AuditLogWithId[];

         if (docs.length > safeLimit) {
            nextCursor = docs[safeLimit]._id.toString();
            data = docs.slice(0, safeLimit) as AuditLogWithId[];
         } else {
            data = docs as AuditLogWithId[];
         }

         return { data, nextCursor };
      } catch (error) {
         logger.error(`[MongoAuditLogRepo] Error finding audit logs for clientId: ${clientId}`, { error });
         throw error;
      }
   }
}
