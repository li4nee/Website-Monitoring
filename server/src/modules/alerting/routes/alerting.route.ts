import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../../../shared/middleware/authenticate.middleware";
import { authorize } from "../../../shared/middleware/authorize.middleware";
import { validateBody, validateParams, validateQuery } from "../../../shared/middleware/zodValidators.middleware";
import { USER_ROLE } from "../../../shared/typings/auth.typings";
import AlertingDependencyContainer from "../dependencies/alerting.dependency";
import { CreateAlertDTO } from "../dtos/createAlert.dto";
import { UpdateAlertDTO } from "../dtos/updateAlert.dto";
import { AlertClientParamSchema, AlertHistoryQueryDTO, AlertIdParamSchema, ListAlertsQueryDTO } from "../dtos/listAlerts.dto";

const router = Router();
const { alertingController } = AlertingDependencyContainer.init().controllers;

/**
 * @route POST /api/v1/alerting/:clientId
 * @desc Create a new alert config for a client
 * @access Private (Super Admin, Client Admin with canManageSettings)
 */
router.post(
   "/:clientId",
   authenticate,
   authorize([USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN]),
   validateBody(CreateAlertDTO),
   (req: Request, res: Response, next: NextFunction) => alertingController.createAlert(req, res, next),
);

/**
 * @route GET /api/v1/alerting
 * @desc List all alert configs for a client (paginated)
 * @access Private (Super Admin, Client Admin, Client User with canViewAnalytics)
 */
router.get(
   "/",
   authenticate,
   authorize([USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.CLIENT_USER]),
   validateQuery(ListAlertsQueryDTO),
   (req: Request, res: Response, next: NextFunction) => alertingController.listAlerts(req, res, next),
);

/**
 * @route GET /api/v1/alerting/:clientId/:id/history
 * @desc Get fire log history for an alert (paginated)
 * @access Private (Super Admin, Client Admin, Client User with canViewAnalytics)
 */
router.get(
   "/:clientId/:id/history",
   authenticate,
   authorize([USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.CLIENT_USER]),
   validateParams(AlertClientParamSchema),
   validateQuery(AlertHistoryQueryDTO),
   (req: Request, res: Response, next: NextFunction) => alertingController.getAlertHistory(req, res, next),
);

/**
 * @route GET /api/v1/alerting/:clientId/:id
 * @desc Get a single alert config
 * @access Private (Super Admin, Client Admin, Client User with canViewAnalytics)
 */
router.get(
   "/:clientId/:id",
   authenticate,
   authorize([USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.CLIENT_USER]),
   validateParams(AlertClientParamSchema),
   (req: Request, res: Response, next: NextFunction) => alertingController.getAlert(req, res, next),
);

/**
 * @route PATCH /api/v1/alerting/:clientId/:id
 * @desc Update an alert config
 * @access Private (Super Admin, Client Admin with canManageSettings)
 */
router.patch(
   "/:clientId/:id",
   authenticate,
   authorize([USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN]),
   validateParams(AlertClientParamSchema),
   validateBody(UpdateAlertDTO),
   (req: Request, res: Response, next: NextFunction) => alertingController.updateAlert(req, res, next),
);

/**
 * @route DELETE /api/v1/alerting/:clientId/:id
 * @desc Delete an alert config
 * @access Private (Super Admin, Client Admin with canManageSettings)
 */
router.delete(
   "/:clientId/:id",
   authenticate,
   authorize([USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN]),
   validateParams(AlertClientParamSchema),
   (req: Request, res: Response, next: NextFunction) => alertingController.deleteAlert(req, res, next),
);

/**
 * @route PATCH /api/v1/alerting/:clientId/:id/enable
 * @desc Enable an alert
 * @access Private (Super Admin, Client Admin with canManageSettings)
 */
router.patch(
   "/:clientId/:id/enable",
   authenticate,
   authorize([USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN]),
   validateParams(AlertClientParamSchema),
   (req: Request, res: Response, next: NextFunction) => alertingController.setEnabled(req, res, next),
);

/**
 * @route PATCH /api/v1/alerting/:clientId/:id/disable
 * @desc Disable an alert
 * @access Private (Super Admin, Client Admin with canManageSettings)
 */
router.patch(
   "/:clientId/:id/disable",
   authenticate,
   authorize([USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN]),
   validateParams(AlertClientParamSchema),
   (req: Request, res: Response, next: NextFunction) => alertingController.setEnabled(req, res, next),
);

export default router;
