import type { Response, NextFunction } from "express";
import { AuthorizedRequest } from "../../../shared/typings/auth.typings";
import { ResourceNotInitializedError } from "../../../shared/typings/error.typings";
import { ResponseFormatter } from "../../../shared/utils/responseFormatter.utils";
import { IAlertingService } from "../contracts/IAlertingService.contract";
import { CreateAlertDTOType } from "../dtos/createAlert.dto";
import { UpdateAlertDTOType } from "../dtos/updateAlert.dto";
import { AlertHistoryQueryDTOType, ListAlertsQueryDTOType } from "../dtos/listAlerts.dto";

export class AlertingController {
   protected alertingService: IAlertingService;

   constructor(alertingService: IAlertingService) {
      if (!alertingService) {
         throw new ResourceNotInitializedError("[AlertingController] AlertingService must be provided to AlertingController");
      }
      this.alertingService = alertingService;
   }

   /**
    * POST /api/v1/alerting/:clientId
    */
   async createAlert(req: AuthorizedRequest, res: Response, next: NextFunction) {
      try {
         const { clientId } = req.params as { clientId: string };
         const body = req.body as CreateAlertDTOType;
         const alert = await this.alertingService.createAlert(req.user!, clientId, body);
         return res.status(201).json(ResponseFormatter.success("Alert created successfully.", 201, { alert }));
      } catch (error) {
         next(error);
      }
   }

   /**
    * GET /api/v1/alerting?clientId=&limit=&cursor=
    */
   async listAlerts(req: AuthorizedRequest, res: Response, next: NextFunction) {
      try {
         const query = req.query as unknown as ListAlertsQueryDTOType;
         const result = await this.alertingService.listAlerts(req.user!, query);
         return res.status(200).json(ResponseFormatter.success("Alerts retrieved successfully.", 200, result));
      } catch (error) {
         next(error);
      }
   }

   /**
    * GET /api/v1/alerting/:clientId/:id
    */
   async getAlert(req: AuthorizedRequest, res: Response, next: NextFunction) {
      try {
         const { clientId, id } = req.params as { clientId: string; id: string };
         const alert = await this.alertingService.getAlert(req.user!, clientId, id);
         return res.status(200).json(ResponseFormatter.success("Alert retrieved successfully.", 200, { alert }));
      } catch (error) {
         next(error);
      }
   }

   /**
    * PATCH /api/v1/alerting/:clientId/:id
    */
   async updateAlert(req: AuthorizedRequest, res: Response, next: NextFunction) {
      try {
         const { clientId, id } = req.params as { clientId: string; id: string };
         const body = req.body as UpdateAlertDTOType;
         const alert = await this.alertingService.updateAlert(req.user!, clientId, id, body);
         return res.status(200).json(ResponseFormatter.success("Alert updated successfully.", 200, { alert }));
      } catch (error) {
         next(error);
      }
   }

   /**
    * DELETE /api/v1/alerting/:clientId/:id
    */
   async deleteAlert(req: AuthorizedRequest, res: Response, next: NextFunction) {
      try {
         const { clientId, id } = req.params as { clientId: string; id: string };
         await this.alertingService.deleteAlert(req.user!, clientId, id);
         return res.status(200).json(ResponseFormatter.success("Alert deleted successfully.", 200, null));
      } catch (error) {
         next(error);
      }
   }

   /**
    * GET /api/v1/alerting/:clientId/:id/history
    */
   async getAlertHistory(req: AuthorizedRequest, res: Response, next: NextFunction) {
      try {
         const { clientId, id } = req.params as { clientId: string; id: string };
         const query = req.query as unknown as AlertHistoryQueryDTOType;
         const result = await this.alertingService.getAlertHistory(req.user!, clientId, id, query);
         return res.status(200).json(ResponseFormatter.success("Alert history retrieved successfully.", 200, result));
      } catch (error) {
         next(error);
      }
   }

   /**
    * PATCH /api/v1/alerting/:clientId/:id/enable
    * PATCH /api/v1/alerting/:clientId/:id/disable
    */
   async setEnabled(req: AuthorizedRequest, res: Response, next: NextFunction) {
      try {
         const { clientId, id } = req.params as { clientId: string; id: string };
         const isEnabled = req.path.endsWith("/enable");
         const alert = await this.alertingService.setEnabled(req.user!, clientId, id, isEnabled);
         const msg = isEnabled ? "Alert enabled successfully." : "Alert disabled successfully.";
         return res.status(200).json(ResponseFormatter.success(msg, 200, { alert }));
      } catch (error) {
         next(error);
      }
   }
}
