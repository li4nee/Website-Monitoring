import { AuthorizedRequest } from "../../../shared/typings/base.typings";
import type { Response, NextFunction } from "express";
import { ResourceNotInitializedError } from "../../../shared/typings/error.typings";
import { AuthService } from "../../auth/services/auth.service";
import { ClientService } from "../services/client.service";
import { ResponseFormatter } from "../../../shared/utils/responseFormatter.utils";

export class ClientController {
   protected authService: AuthService;
   protected clientService: ClientService;
   constructor(authService: AuthService, clientService: ClientService) {
      if (!authService) {
         throw new ResourceNotInitializedError("AuthService must be provided to AuthController");
      }
      if (!clientService) {
         throw new ResourceNotInitializedError("ClientService must be provided to ClientController");
      }
      this.authService = authService;
      this.clientService = clientService;
   }
   /**
    * Onboard a new client
    */
   async createClient(req: AuthorizedRequest, res: Response, next: NextFunction) {
      try {
         // This extra checking dispite middleware to ensure that no way other user can use this endpoint.
         const isSuperAdmin = await this.authService.isSuperAdmin(req.user!.id);
         if (!isSuperAdmin) {
            return res.status(403).json(ResponseFormatter.error("Access denied.", 403));
         }
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
         if (!clientId) {
            return res.status(400).json(ResponseFormatter.error("Client ID is required.", 400));
         }
         return res.status(201).json(ResponseFormatter.success("Client user created successfully.", 201));
      } catch (error) {
         next(error);
      }
   }
}
