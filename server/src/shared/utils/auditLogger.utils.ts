import { AuditLogModel } from "../infra/db/mongo/models/auditLog.model";
import logger from "../config/logger.config";
import { USER_ROLE } from "../typings/auth.typings";

export interface AuditLogEntry {
   action: string;
   actorId: string;
   actorRole: USER_ROLE;
   clientId?: string;
   targetType?: string;
   targetId?: string;
   metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget audit trail writer.
 * No miss or error slows down the main flow.
 */
export class AuditLogger {
   static log(entry: AuditLogEntry): void {
      AuditLogModel.create({
         action: entry.action,
         actorId: entry.actorId,
         actorRole: entry.actorRole,
         clientId: entry.clientId,
         targetType: entry.targetType,
         targetId: entry.targetId,
         metadata: entry.metadata,
      }).catch((error) => {
         logger.error("[AuditLogger] Failed to write audit log entry", {
            action: entry.action,
            actorId: entry.actorId,
            error: error instanceof Error ? error.message : error,
         });
      });
   }
}
