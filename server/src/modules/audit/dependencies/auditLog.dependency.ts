import { AuditLogWithId } from "../../../shared/infra/db/mongo/models/auditLog.model";
import { AuditLogBaseRepo } from "../repos/auditLogBase.repo";
import { MongoAuditLogRepo } from "../repos/auditLog.repo";
import { AuditLogService } from "../services/auditLog.service";
import { IAuditLogService } from "../contracts/IAuditLogService.contract";
import { AuditLogController } from "../controllers/auditLog.controller";

export interface AuditLogDependenciesType {
   repos: { auditLogRepo: AuditLogBaseRepo<AuditLogWithId> };
   services: { auditLogService: IAuditLogService };
   controllers: { auditLogController: AuditLogController };
}

export class AuditLogDependencyContainer {
   static init(): AuditLogDependenciesType {
      const repos = { auditLogRepo: new MongoAuditLogRepo() };
      const services = { auditLogService: new AuditLogService(repos.auditLogRepo) };
      const controllers = { auditLogController: new AuditLogController(services.auditLogService) };

      return { repos, services, controllers };
   }
}

export default AuditLogDependencyContainer;
