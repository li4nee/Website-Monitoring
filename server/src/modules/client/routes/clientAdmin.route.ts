import { authenticate } from "../../../shared/middleware/authenticate.middleware";
import { authorize } from "../../../shared/middleware/authorize.middleware";
import { mongoObjectId, validateBody, validateParams } from "../../../shared/middleware/zodValidators.middleware";
import { USER_ROLE } from "../../../shared/typings/auth.typings";
import InitializedClientContainer from "../dependencies/client.dependency";
import { Router, Request, Response, NextFunction } from "express";
import { CreateClientDTO } from "../dtos/createClient.dto";
import { CreateClientUserDTO } from "../dtos/createClientUser.dto";
import { CreateApiKeyDTO } from "../dtos/createApiKey.dto";
import { clientAndKeyParamSchema, clientIdParamSchema } from "../dtos/clientIdAndKeyParams.dto";


const router = Router();
const { controllers } = InitializedClientContainer;
const { clientController } = controllers;

/**
 * @route POST /api/v1/admin/clients/onboard
 * @desc Create a new client
 * @access Private (Super Admin only)
 */
router.post(
   "/onboard",
   authenticate,
   authorize([USER_ROLE.SUPER_ADMIN]),
   validateBody(CreateClientDTO),
   (req: Request, res: Response, next: NextFunction) => clientController.createClient(req, res, next),
);

/**
 * @route POST /api/v1/admin/clients/:clientId/users
 * @desc Create a new user for a specific client
 * @access Private (Super Admin and Client Admin only)
 */
router.post(
   "/:clientId/users",
   authenticate,
   authorize([USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN]),
   validateParams(clientIdParamSchema),
   validateBody(CreateClientUserDTO),
   (req: Request, res: Response, next: NextFunction) => clientController.createClientUser(req, res, next),
);

/**
 * @route POST /api/v1/admin/clients/:clientId/api-keys
 * @desc Create new API keys for a specific client. The keys are only visible at time of creation.
 * @access Private (Super Admin and Client Admin only)
 */
router.post(
   "/:clientId/api-keys",
   authenticate,
   authorize([USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN]),
   validateParams(clientIdParamSchema),
   validateBody(CreateApiKeyDTO),
   (req: Request, res: Response, next: NextFunction) => clientController.createApiKeysForClient(req, res, next),
);

/**
 * @route GET /api/v1/admin/clients/:clientId/api-keys
 * @desc Get all API keys for a specific client. The actual key values are never returned, only their metadata.
 * @access Private (Super Admin and Client Admin only)
 */
router.get(
   "/:clientId/api-keys",
   authenticate,
   authorize([USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN]),
   validateParams(clientIdParamSchema),
   (req: Request, res: Response, next: NextFunction) => clientController.getApiKeysForClient(req, res, next),
);

/**
 * @route GET /api/v1/admin/clients/:clientId/api-keys/:id
 * @desc Get a specific API key by ID for a specific client. The actual key value is never returned, only its metadata.
 * @access Private (Super Admin and Client Admin only)
 */
router.get(
   "/:clientId/api-keys/:id",
   authenticate,
   authorize([USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN]),
   validateParams(clientAndKeyParamSchema),
   (req: Request, res: Response, next: NextFunction) => clientController.getApiKeyFromId(req, res, next),
);

export default router;
