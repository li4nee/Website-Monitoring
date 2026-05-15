import { AuthorizedRequest } from "../../../shared/typings/auth.typings";
import type { Response, NextFunction } from "express";
import { InvalidInputError, ResourceNotInitializedError } from "../../../shared/typings/error.typings";
import { ResponseFormatter } from "../../../shared/utils/responseFormatter.utils";
import { IClientService } from "../contracts/IClientService.contract";
import { IApiKeyService } from "../contracts/IApiKeyService.contract";

export class ClientController {
   protected clientService: IClientService;
   protected apiKeyService: IApiKeyService;
   constructor(clientService: IClientService, apiKeyService: IApiKeyService) {
      if (!apiKeyService) {
         throw new ResourceNotInitializedError("[CLientController] ApiKeyService must be provided to ClientController");
      }
      if (!clientService) {
         throw new ResourceNotInitializedError("[CLientController] ClientService must be provided to ClientController");
      }
      this.clientService = clientService;
      this.apiKeyService = apiKeyService;
   }

   private checkIfClientIdIsThereAndValid(clientId: string | string[]): void {
      if (!clientId) {
         throw new InvalidInputError("Client ID is required.");
      }
      if (typeof clientId !== "string") {
         throw new InvalidInputError("Client ID must be a string.");
      }
   }
   /**
    * Onboard a new client
    */
   async createClient(req: AuthorizedRequest, res: Response, next: NextFunction) {
      try {
         // This extra checking dispite middleware to ensure that no way other user can use this endpoint.
         const client = await this.clientService.createClient(req.body, req.user!.id);
         return res.status(201).json(ResponseFormatter.success("Client created successfully.", 201, { client }));
      } catch (error) {
         next(error);
      }
   }

   /**
    * Create a new user for a specific client
    */
   async createClientUser(req: AuthorizedRequest, res: Response, next: NextFunction) {
      try {
         const { clientId } = req.params;
         this.checkIfClientIdIsThereAndValid(clientId);
         const result = await this.clientService.createClientUser(clientId as string, req.body, req.user!);
         return res.status(201).json(ResponseFormatter.success("Client user created successfully.", 201, { user: result }));
      } catch (error) {
         next(error);
      }
   }

   /**
    * Create new API keys for a specific client
    */
   async createApiKeysForClient(req: AuthorizedRequest, res: Response, next: NextFunction) {
      try {
         const { clientId } = req.params;
         this.checkIfClientIdIsThereAndValid(clientId);
         const apiKey = await this.apiKeyService.createApiKeysForClient(clientId as string, req.body, req.user!);
         return res.status(201).json(ResponseFormatter.success("API keys created successfully.", 201, apiKey));
      } catch (error) {
         next(error);
      }
   }

   /**
    * Get all API keys for a specific client. The actual key values are never returned, only their metadata.
    */
   async getApiKeysForClient(req: AuthorizedRequest, res: Response, next: NextFunction) {
      try {
         const { clientId } = req.params;
         this.checkIfClientIdIsThereAndValid(clientId);
         const apiKeys = await this.apiKeyService.getApiKeysForClient(clientId as string, req.user!);
         return res.status(200).json(ResponseFormatter.success("API keys retrieved successfully.", 200, { apiKeys }));
      } catch (error) {
         next(error);
      }
   }

   /**
    * Get a specific API key by ID for a specific client. The actual key value is never returned, only its metadata.
    */
   async getApiKeyFromId(req: AuthorizedRequest, res: Response, next: NextFunction) {
      try {
         const { clientId, id } = req.params;
         this.checkIfClientIdIsThereAndValid(clientId);
         if (!id) {
            return res.status(400).json(ResponseFormatter.error("API Key ID is required.", 400));
         }
         if (typeof id !== "string") {
            return res.status(400).json(ResponseFormatter.error("API Key ID must be a string.", 400));
         }
         const apiKey = await this.apiKeyService.getApiKeyFromId(clientId as string, id, req.user!);
         if (!apiKey) {
            return res.status(404).json(ResponseFormatter.error("API key not found.", 404));
         }
         return res.status(200).json(ResponseFormatter.success("API key retrieved successfully.", 200, { apiKey }));
      } catch (error) {
         next(error);
      }
   }

   /**
    * DELETE /api/v1/admin/clients/:clientId/api-keys/:id
    */
   async revokeApiKey(req: AuthorizedRequest, res: Response, next: NextFunction) {
      try {
         const { clientId, id } = req.params;
         this.checkIfClientIdIsThereAndValid(clientId);
         await this.apiKeyService.revokeApiKey(clientId as string, id as string, req.user!);
         return res.status(200).json(ResponseFormatter.success("API key revoked successfully.", 200, null));
      } catch (error) {
         next(error);
      }
   }

   /**
    * GET /api/v1/admin/clients
    */
   async listClients(req: AuthorizedRequest, res: Response, next: NextFunction) {
      try {
         const limit = parseInt((req.query.limit as string) || "20", 10);
         const cursor = req.query.cursor as string | undefined;
         const result = await this.clientService.listClients(req.user!, limit, cursor);
         return res.status(200).json(ResponseFormatter.success("Clients retrieved successfully.", 200, result));
      } catch (error) {
         next(error);
      }
   }

   /**
    * GET /api/v1/admin/clients/:clientId
    */
   async getClient(req: AuthorizedRequest, res: Response, next: NextFunction) {
      try {
         const { clientId } = req.params;
         this.checkIfClientIdIsThereAndValid(clientId);
         const client = await this.clientService.getClient(clientId as string, req.user!);
         return res.status(200).json(ResponseFormatter.success("Client retrieved successfully.", 200, { client }));
      } catch (error) {
         next(error);
      }
   }

   /**
    * PATCH /api/v1/admin/clients/:clientId
    */
   async updateClient(req: AuthorizedRequest, res: Response, next: NextFunction) {
      try {
         const { clientId } = req.params;
         this.checkIfClientIdIsThereAndValid(clientId);
         const client = await this.clientService.updateClient(clientId as string, req.body, req.user!);
         return res.status(200).json(ResponseFormatter.success("Client updated successfully.", 200, { client }));
      } catch (error) {
         next(error);
      }
   }

   /**
    * GET /api/v1/admin/clients/:clientId/users
    */
   async listUsersForClient(req: AuthorizedRequest, res: Response, next: NextFunction) {
      try {
         const { clientId } = req.params;
         this.checkIfClientIdIsThereAndValid(clientId);
         const limit = parseInt((req.query.limit as string) || "20", 10);
         const cursor = req.query.cursor as string | undefined;
         const result = await this.clientService.listUsersForClient(clientId as string, req.user!, limit, cursor);
         return res.status(200).json(ResponseFormatter.success("Users retrieved successfully.", 200, result));
      } catch (error) {
         next(error);
      }
   }

   /**
    * PATCH /api/v1/admin/clients/:clientId/users/:userId/permissions
    */
   async updateUserPermissions(req: AuthorizedRequest, res: Response, next: NextFunction) {
      try {
         const { clientId, userId } = req.params;
         this.checkIfClientIdIsThereAndValid(clientId);
         const user = await this.clientService.updateUserPermissions(clientId as string, userId as string, req.body, req.user!);
         return res.status(200).json(ResponseFormatter.success("User permissions updated successfully.", 200, { user }));
      } catch (error) {
         next(error);
      }
   }

   /**
    * PATCH /api/v1/admin/clients/:clientId/users/:userId/activate
    * PATCH /api/v1/admin/clients/:clientId/users/:userId/deactivate
    */
   async setUserActive(req: AuthorizedRequest, res: Response, next: NextFunction) {
      try {
         const { clientId, userId } = req.params;
         this.checkIfClientIdIsThereAndValid(clientId);
         const isActive = req.path.endsWith("/activate");
         const user = await this.clientService.setUserActive(clientId as string, userId as string, isActive, req.user!);
         const msg = isActive ? "User activated successfully." : "User deactivated successfully.";
         return res.status(200).json(ResponseFormatter.success(msg, 200, { user }));
      } catch (error) {
         next(error);
      }
   }
}
