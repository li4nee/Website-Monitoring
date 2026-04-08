import { authenticate } from "../../../shared/middleware/authenticate.middleware";
import { authorize } from "../../../shared/middleware/authorize.middleware";
import { validateBody } from "../../../shared/middleware/zodValidators.middleware";
import { USER_ROLE } from "../../../shared/typings/base.typings";
import InitializedClientContainer from "../dependencies/client.dependency";
import { Router } from "express";
import { CreateClientDTO } from "../dtos/createClient.dto";

const router = Router();
const { controllers } = InitializedClientContainer;
const { clientController } = controllers;

/**
 * @route POST /api/v1/admin/clients/onboard
 * @desc Create a new client
 * @access Private (Super Admin only)
 */
router.post("/onboard", authenticate, authorize([USER_ROLE.SUPER_ADMIN]), validateBody(CreateClientDTO), (req, res, next) =>
   clientController.createClient(req, res, next),
);

/**
 * @route POST /api/v1/admin/clients/:clientId/users
 * @desc Create a new user for a specific client
 * @access Private (Super Admin and Client Admin only)
 */
router.post("/:clientId/users", authenticate, authorize([USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN]), (req, res, next) =>
   clientController.createClientUser(req, res, next),
);

export default router;
