import { authenticate } from "../../../shared/middleware/authenticate.middleware";
import { authorize } from "../../../shared/middleware/authorize.middleware";
import { mongoObjectId, validateBody, validateParams } from "../../../shared/middleware/zodValidators.middleware";
import { USER_ROLE } from "../../../shared/typings/auth.typings";
import ClientDependeniesContainer from "../dependencies/client.dependency";
import { Router, Request, Response, NextFunction } from "express";
import { CreateClientDTO } from "../dtos/createClient.dto";
import { CreateClientUserDTO } from "../dtos/createClientUser.dto";
import { CreateApiKeyDTO } from "../dtos/createApiKey.dto";
import { clientAndKeyParamSchema, clientIdParamSchema } from "../dtos/clientIdAndKeyParams.dto";
import { UpdateClientDTO } from "../dtos/updateClient.dto";
import { UpdateUserPermissionsDTO, userIdParamSchema } from "../dtos/updateUser.dto";

const router = Router();
const { clientController } = ClientDependeniesContainer.init().controllers;

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

/**
 * @route DELETE /api/v1/admin/clients/:clientId/api-keys/:id
 * @desc Revoke an API key
 * @access Private (Super Admin and Client Admin with canCreateApiKeys)
 */
router.delete(
   "/:clientId/api-keys/:id",
   authenticate,
   authorize([USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN]),
   validateParams(clientAndKeyParamSchema),
   (req: Request, res: Response, next: NextFunction) => clientController.revokeApiKey(req, res, next),
);

/**
 * @route GET /api/v1/admin/clients
 * @desc List all clients
 * @access Private (Super Admin only)
 */
router.get(
   "/",
   authenticate,
   authorize([USER_ROLE.SUPER_ADMIN]),
   (req: Request, res: Response, next: NextFunction) => clientController.listClients(req, res, next),
);

/**
 * @route GET /api/v1/admin/clients/:clientId
 * @desc Get a single client
 * @access Private (Super Admin or own Client Admin)
 */
router.get(
   "/:clientId",
   authenticate,
   authorize([USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN]),
   validateParams(clientIdParamSchema),
   (req: Request, res: Response, next: NextFunction) => clientController.getClient(req, res, next),
);

/**
 * @route PATCH /api/v1/admin/clients/:clientId
 * @desc Update client details
 * @access Private (Super Admin only)
 */
router.patch(
   "/:clientId",
   authenticate,
   authorize([USER_ROLE.SUPER_ADMIN]),
   validateParams(clientIdParamSchema),
   validateBody(UpdateClientDTO),
   (req: Request, res: Response, next: NextFunction) => clientController.updateClient(req, res, next),
);

/**
 * @route PATCH /api/v1/admin/clients/:clientId/activate
 * @desc Activate a client (re-enables API key validation for its ingest traffic)
 * @access Private (Super Admin only)
 */
router.patch(
   "/:clientId/activate",
   authenticate,
   authorize([USER_ROLE.SUPER_ADMIN]),
   validateParams(clientIdParamSchema),
   (req: Request, res: Response, next: NextFunction) => clientController.setClientActive(req, res, next),
);

/**
 * @route PATCH /api/v1/admin/clients/:clientId/deactivate
 * @desc Suspend a client (all its API keys are rejected by validateApiKey until reactivated)
 * @access Private (Super Admin only)
 */
router.patch(
   "/:clientId/deactivate",
   authenticate,
   authorize([USER_ROLE.SUPER_ADMIN]),
   validateParams(clientIdParamSchema),
   (req: Request, res: Response, next: NextFunction) => clientController.setClientActive(req, res, next),
);

/**
 * @route GET /api/v1/admin/clients/:clientId/users
 * @desc List all users for a client
 * @access Private (Super Admin and Client Admin with canManageUsers)
 */
router.get(
   "/:clientId/users",
   authenticate,
   authorize([USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN]),
   validateParams(clientIdParamSchema),
   (req: Request, res: Response, next: NextFunction) => clientController.listUsersForClient(req, res, next),
);

/**
 * @route PATCH /api/v1/admin/clients/:clientId/users/:userId/permissions
 * @desc Update a user's permissions
 * @access Private (Super Admin and Client Admin with canManageUsers)
 */
router.patch(
   "/:clientId/users/:userId/permissions",
   authenticate,
   authorize([USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN]),
   validateParams(userIdParamSchema),
   validateBody(UpdateUserPermissionsDTO),
   (req: Request, res: Response, next: NextFunction) => clientController.updateUserPermissions(req, res, next),
);

/**
 * @route PATCH /api/v1/admin/clients/:clientId/users/:userId/activate
 * @desc Activate a user
 * @access Private (Super Admin and Client Admin with canManageUsers)
 */
router.patch(
   "/:clientId/users/:userId/activate",
   authenticate,
   authorize([USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN]),
   validateParams(userIdParamSchema),
   (req: Request, res: Response, next: NextFunction) => clientController.setUserActive(req, res, next),
);

/**
 * @route PATCH /api/v1/admin/clients/:clientId/users/:userId/deactivate
 * @desc Deactivate a user
 * @access Private (Super Admin and Client Admin with canManageUsers)
 */
router.patch(
   "/:clientId/users/:userId/deactivate",
   authenticate,
   authorize([USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN]),
   validateParams(userIdParamSchema),
   (req: Request, res: Response, next: NextFunction) => clientController.setUserActive(req, res, next),
);

export default router;
