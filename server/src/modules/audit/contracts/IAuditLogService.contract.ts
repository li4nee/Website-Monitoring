import { UserInsideAuthorizedRequest } from "../../../shared/typings/auth.typings";
import { AuditLogWithId } from "../../../shared/infra/db/mongo/models/auditLog.model";
import { ListAuditLogsQueryDTOType } from "../dtos/listAuditLogs.dto";

export interface IAuditLogService {
   listAuditLogs(
      user: UserInsideAuthorizedRequest,
      query: ListAuditLogsQueryDTOType,
   ): Promise<{ data: AuditLogWithId[]; nextCursor?: string }>;
}
