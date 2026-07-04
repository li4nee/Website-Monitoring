import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../../../shared/middleware/authenticate.middleware";
import { authorize } from "../../../shared/middleware/authorize.middleware";
import { validateQuery } from "../../../shared/middleware/zodValidators.middleware";
import { USER_ROLE } from "../../../shared/typings/auth.typings";
import AuditLogDependencyContainer from "../dependencies/auditLog.dependency";
import { ListAuditLogsQueryDTO } from "../dtos/listAuditLogs.dto";

const router = Router();
const { auditLogController } = AuditLogDependencyContainer.init().controllers;

/**
 * @route GET /api/v1/audit-logs?clientId=&limit=&cursor=
 * @desc List audit log entries for a client (paginated)
 * @access Private (Super Admin, Client Admin for their own client)
 */
router.get(
   "/",
   authenticate,
   authorize([USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN]),
   validateQuery(ListAuditLogsQueryDTO),
   (req: Request, res: Response, next: NextFunction) => auditLogController.listAuditLogs(req, res, next),
);

export default router;
