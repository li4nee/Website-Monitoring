import { Types } from "mongoose";
import logger from "../../../shared/config/logger.config";
import { AlertingDocument } from "../../../shared/infra/db/mongo/models/alerting.model";
import { AlertFireLogDocument } from "../../../shared/infra/db/mongo/models/alertFireLog.model";
import { USER_ROLE, UserInsideAuthorizedRequest } from "../../../shared/typings/auth.typings";
import { PermissionNotGranted, ResourceNotFoundError, ResourceNotInitializedError } from "../../../shared/typings/error.typings";
import { AlertingBaseRepo } from "../repos/alertingBase.repo";
import { AlertFireLogBaseRepo } from "../repos/alertFireLogBase.repo";
import { IAlertingService } from "../contracts/IAlertingService.contract";
import { CreateAlertDTOType } from "../dtos/createAlert.dto";
import { UpdateAlertDTOType } from "../dtos/updateAlert.dto";
import { AlertHistoryQueryDTOType, ListAlertsQueryDTOType } from "../dtos/listAlerts.dto";
import { IncidentFeedItem } from "../dtos/incidentFeed.dto";

export class AlertingService implements IAlertingService {
   private alertingRepo: AlertingBaseRepo<AlertingDocument>;
   private fireLogRepo: AlertFireLogBaseRepo<AlertFireLogDocument>;

   constructor(
      alertingRepo: AlertingBaseRepo<AlertingDocument>,
      fireLogRepo: AlertFireLogBaseRepo<AlertFireLogDocument>,
   ) {
      if (!alertingRepo || !fireLogRepo) {
         throw new ResourceNotInitializedError("[AlertingService] All repositories must be provided to AlertingService");
      }
      this.alertingRepo = alertingRepo;
      this.fireLogRepo = fireLogRepo;
   }

   private checkClientAccess(user: UserInsideAuthorizedRequest, targetClientId: string): void {
      if (user.role === USER_ROLE.SUPER_ADMIN) return;

      if (!user.clientId || user.clientId !== targetClientId) {
         throw new PermissionNotGranted("You are not authorized to manage alerts for this client.");
      }
   }

   private checkManagePermission(user: UserInsideAuthorizedRequest, targetClientId: string): void {
      this.checkClientAccess(user, targetClientId);
      if (user.role !== USER_ROLE.SUPER_ADMIN && !user.permissions.canManageSettings) {
         throw new PermissionNotGranted("You do not have permission to manage alert settings.");
      }
   }

   private checkViewPermission(user: UserInsideAuthorizedRequest, targetClientId: string): void {
      this.checkClientAccess(user, targetClientId);
      if (user.role !== USER_ROLE.SUPER_ADMIN && !user.permissions.canViewAnalytics) {
         throw new PermissionNotGranted("You do not have permission to view alerts.");
      }
   }

   async createAlert(user: UserInsideAuthorizedRequest, clientId: string, data: CreateAlertDTOType): Promise<AlertingDocument> {
      try {
         this.checkManagePermission(user, clientId);
         const alert = await this.alertingRepo.create({
            ...data,
            clientId: new Types.ObjectId(clientId),
            createdBy: new Types.ObjectId(user.id),
            isEnabled: true,
         });
         logger.info(`[AlertingService] Alert created: ${alert._id} for clientId: ${clientId} by user: ${user.id}`);
         return alert;
      } catch (error) {
         logger.error("[AlertingService] Error creating alert", { error, clientId });
         throw error;
      }
   }

   async listAlerts(
      user: UserInsideAuthorizedRequest,
      query: ListAlertsQueryDTOType,
   ): Promise<{ data: AlertingDocument[]; nextCursor?: string }> {
      try {
         this.checkViewPermission(user, query.clientId);
         const result = await this.alertingRepo.findByClientId(query.clientId, query.limit, query.cursor);
         logger.info(`[AlertingService] Listed alerts for clientId: ${query.clientId}`);
         return result;
      } catch (error) {
         logger.error("[AlertingService] Error listing alerts", { error, query });
         throw error;
      }
   }

   async getAlert(user: UserInsideAuthorizedRequest, clientId: string, alertId: string): Promise<AlertingDocument> {
      try {
         this.checkViewPermission(user, clientId);
         const alert = await this.alertingRepo.findById(alertId);
         if (!alert) throw new ResourceNotFoundError("Alert not found.");
         if (alert.clientId.toString() !== clientId) {
            throw new PermissionNotGranted("You are not authorized to access this alert.");
         }
         return alert;
      } catch (error) {
         logger.error("[AlertingService] Error getting alert", { error, clientId, alertId });
         throw error;
      }
   }

   async updateAlert(
      user: UserInsideAuthorizedRequest,
      clientId: string,
      alertId: string,
      data: UpdateAlertDTOType,
   ): Promise<AlertingDocument> {
      try {
         this.checkManagePermission(user, clientId);
         const existing = await this.alertingRepo.findById(alertId);
         if (!existing) throw new ResourceNotFoundError("Alert not found.");
         if (existing.clientId.toString() !== clientId) {
            throw new PermissionNotGranted("You are not authorized to update this alert.");
         }
         const updated = await this.alertingRepo.update(alertId, data);
         if (!updated) throw new ResourceNotFoundError("Alert not found.");
         logger.info(`[AlertingService] Alert updated: ${alertId} by user: ${user.id}`);
         return updated;
      } catch (error) {
         logger.error("[AlertingService] Error updating alert", { error, clientId, alertId });
         throw error;
      }
   }

   async deleteAlert(user: UserInsideAuthorizedRequest, clientId: string, alertId: string): Promise<void> {
      try {
         this.checkManagePermission(user, clientId);
         const existing = await this.alertingRepo.findById(alertId);
         if (!existing) throw new ResourceNotFoundError("Alert not found.");
         if (existing.clientId.toString() !== clientId) {
            throw new PermissionNotGranted("You are not authorized to delete this alert.");
         }
         await this.alertingRepo.delete(alertId);
         await this.fireLogRepo.deleteByAlertId(alertId);
         logger.info(`[AlertingService] Alert deleted: ${alertId} by user: ${user.id}`);
      } catch (error) {
         logger.error("[AlertingService] Error deleting alert", { error, clientId, alertId });
         throw error;
      }
   }

   async setEnabled(
      user: UserInsideAuthorizedRequest,
      clientId: string,
      alertId: string,
      isEnabled: boolean,
   ): Promise<AlertingDocument> {
      try {
         this.checkManagePermission(user, clientId);
         const existing = await this.alertingRepo.findById(alertId);
         if (!existing) throw new ResourceNotFoundError("Alert not found.");
         if (existing.clientId.toString() !== clientId) {
            throw new PermissionNotGranted("You are not authorized to modify this alert.");
         }
         const updated = await this.alertingRepo.setEnabled(alertId, isEnabled);
         if (!updated) throw new ResourceNotFoundError("Alert not found.");
         logger.info(`[AlertingService] Alert ${alertId} ${isEnabled ? "enabled" : "disabled"} by user: ${user.id}`);
         return updated;
      } catch (error) {
         logger.error("[AlertingService] Error setting alert enabled status", { error, clientId, alertId, isEnabled });
         throw error;
      }
   }

   async getAlertHistory(
      user: UserInsideAuthorizedRequest,
      clientId: string,
      alertId: string,
      query: AlertHistoryQueryDTOType,
   ): Promise<{ data: AlertFireLogDocument[]; nextCursor?: string }> {
      try {
         this.checkViewPermission(user, clientId);
         const alert = await this.alertingRepo.findById(alertId);
         if (!alert) throw new ResourceNotFoundError("Alert not found.");
         if (alert.clientId.toString() !== clientId) {
            throw new PermissionNotGranted("You are not authorized to view history for this alert.");
         }
         const result = await this.fireLogRepo.findByAlertId(alertId, query.limit, query.cursor);
         logger.info(`[AlertingService] Alert history retrieved for alertId: ${alertId}`);
         return result;
      } catch (error) {
         logger.error("[AlertingService] Error getting alert history", { error, clientId, alertId });
         throw error;
      }
   }

   async getIncidents(
      user: UserInsideAuthorizedRequest,
      clientId: string,
      query: AlertHistoryQueryDTOType,
   ): Promise<{ data: IncidentFeedItem[]; nextCursor?: string }> {
      try {
         this.checkViewPermission(user, clientId);
         const result = await this.fireLogRepo.findByClientId(clientId, query.limit, query.cursor);
         logger.info(`[AlertingService] Incidents retrieved for clientId: ${clientId}`);
         return result;
      } catch (error) {
         logger.error("[AlertingService] Error getting incidents", { error, clientId });
         throw error;
      }
   }
}
