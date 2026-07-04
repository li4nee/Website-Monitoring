import logger from "../../../shared/config/logger.config";
import { AuditLogWithId } from "../../../shared/infra/db/mongo/models/auditLog.model";
import { UserInsideAuthorizedRequest } from "../../../shared/typings/auth.typings";
import { AuthorizationUtils } from "../../../shared/utils/authorization.utils";
import { ResourceNotInitializedError } from "../../../shared/typings/error.typings";
import { AuditLogBaseRepo } from "../repos/auditLogBase.repo";
import { IAuditLogService } from "../contracts/IAuditLogService.contract";
import { ListAuditLogsQueryDTOType } from "../dtos/listAuditLogs.dto";

export class AuditLogService implements IAuditLogService {
   private auditLogRepo: AuditLogBaseRepo<AuditLogWithId>;

   constructor(auditLogRepo: AuditLogBaseRepo<AuditLogWithId>) {
      if (!auditLogRepo) {
         throw new ResourceNotInitializedError("[AuditLogService] AuditLog repository must be provided to AuditLogService");
      }
      this.auditLogRepo = auditLogRepo;
   }

   async listAuditLogs(
      user: UserInsideAuthorizedRequest,
      query: ListAuditLogsQueryDTOType,
   ): Promise<{ data: AuditLogWithId[]; nextCursor?: string }> {
      try {
         AuthorizationUtils.canViewAuditLogs(user, query.clientId);
         const result = await this.auditLogRepo.findByClientId(query.clientId, query.limit, query.cursor);
         logger.info(`[AuditLogService] Audit logs listed for clientId: ${query.clientId} by user: ${user.id}`);
         return result;
      } catch (error) {
         logger.error("[AuditLogService] Error listing audit logs", { error, query });
         throw error;
      }
   }
}
