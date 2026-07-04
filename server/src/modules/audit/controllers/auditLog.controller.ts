import type { Response, NextFunction } from "express";
import { AuthorizedRequest } from "../../../shared/typings/auth.typings";
import { ResourceNotInitializedError } from "../../../shared/typings/error.typings";
import { ResponseFormatter } from "../../../shared/utils/responseFormatter.utils";
import { IAuditLogService } from "../contracts/IAuditLogService.contract";
import { ListAuditLogsQueryDTOType } from "../dtos/listAuditLogs.dto";

export class AuditLogController {
   protected auditLogService: IAuditLogService;

   constructor(auditLogService: IAuditLogService) {
      if (!auditLogService) {
         throw new ResourceNotInitializedError("[AuditLogController] AuditLogService must be provided to AuditLogController");
      }
      this.auditLogService = auditLogService;
   }

   /**
    * GET /api/v1/audit-logs?clientId=&limit=&cursor=
    */
   async listAuditLogs(req: AuthorizedRequest, res: Response, next: NextFunction) {
      try {
         const query = req.query as unknown as ListAuditLogsQueryDTOType;
         const result = await this.auditLogService.listAuditLogs(req.user!, query);
         return res.status(200).json(ResponseFormatter.success("Audit logs retrieved successfully.", 200, result));
      } catch (error) {
         next(error);
      }
   }
}
