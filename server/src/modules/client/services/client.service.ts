import { Types } from "mongoose";
import logger from "../../../shared/config/logger.config";
import { Client, ClientDocument } from "../../../shared/models/client.model";
import { User, UserDocument, UserWithId } from "../../../shared/models/user.model";
import { InvalidInputError, PermissionNotGranted, ResourceNotInitializedError } from "../../../shared/typings/error.typings";
import { UserBaseRepo } from "../../auth/repos/userBase.repo";
import { CreateClientDTOType } from "../dtos/createClient.dto";
import { ClientBaseRepo } from "../repos/clientBase.repo";
import { USER_ROLE, UserInsideAuthorizedRequest } from "../../../shared/typings/base.typings";
import { AuthorizationUtils } from "../../../shared/utils/authorization.utils";
import { CreateClientUserDTO, CreateClientUserDTOType } from "../dtos/createClientUser.dto";
import crypto from "crypto";
export class ClientService {
   protected clientRepo: ClientBaseRepo<Client>;
   // protected apiKeyRepo: ApiKeyBaseRepo<ApiKeyWithId>;
   protected userRepo: UserBaseRepo<UserWithId>;

   constructor(clientRepo: ClientBaseRepo<Client>, userRepo: UserBaseRepo<UserWithId>) {
      if (!clientRepo) {
         throw new ResourceNotInitializedError("Client repository must be provided to ClientService");
      }
      // if (!apiKeyRepo) {
      //    throw new ResourceNotInitializedError("API Key repository must be provided to ClientService");
      // }
      if (!userRepo) {
         throw new ResourceNotInitializedError("User repository must be provided to ClientService");
      }
      this.clientRepo = clientRepo;
      // this.apiKeyRepo = apiKeyRepo;
      this.userRepo = userRepo;
   }

   /**
    * Example : nishant pokharel -> nishant-pokharel
    * @param name
    * @returns slug generated from the client name, suitable for URLs and unique identification
    */
   private generateSlug(name: string): string {
      return name
         .toLowerCase()
         .replace(/[^a-z0-9]+/g, "-")
         .replace(/^-+|-+$/g, "")
         .trim();
   }

   private async checkIfClientUserExistsAndThrowError(username: string, email: string): Promise<void> {
      const emailExists = await this.userRepo.findIfAnyExists(false, email);
      if (emailExists) throw new InvalidInputError("A user with the same email already exists.");
      const usernameExists = await this.userRepo.findByUsername(username);
      if (usernameExists) throw new InvalidInputError("A user with the same username already exists.");
   }

   private formatUserResponseWithoutPassword(user: User): Omit<User, "password" | "trash" | "isActive"> {
      const { password, trash, isActive, ...rest } = user;
      return rest;
   }

   async createClient(clientData: CreateClientDTOType, createdBy: string): Promise<Client> {
      try {
         const { name, email, description, website } = clientData;
         const slug = this.generateSlug(name);

         const existingClient = await this.clientRepo.findBySlug(slug, true);
         if (existingClient) {
            throw new InvalidInputError("A client with the same name already exists. Please choose a different name.");
         }

         const newClient = await this.clientRepo.create({
            name,
            email,
            description,
            website,
            slug,
            createdBy: new Types.ObjectId(createdBy),
         });
         logger.info(`Client created successfully with slug : ${newClient.slug} by user: ${createdBy}`);
         return newClient;
      } catch (error) {
         logger.error("Error creating client", { error, clientData, createdBy });
         throw error;
      }
   }

   async createClientUser(
      clientId: string,
      userData: CreateClientUserDTOType,
      createdBy: UserInsideAuthorizedRequest,
   ): Promise<Omit<User, "password" | "trash" | "isActive">> {
      try {
         if (!AuthorizationUtils.canCreateClientUser(createdBy, clientId))
            throw new PermissionNotGranted("Permission denied to create client user.");

         const client = await this.clientRepo.findById(clientId, true);
         if (!client) throw new InvalidInputError("Client not found");

         await this.checkIfClientUserExistsAndThrowError(userData.username, userData.email);

         const newUserData: Partial<User> = {
            username: userData.username,
            email: userData.email,
            password: userData.password,
            role: userData.role,
            clientId: new Types.ObjectId(clientId),
         };

         if (userData.role === USER_ROLE.CLIENT_ADMIN) {
            newUserData.permissions = {
               canCreateApiKeys: true,
               canManageUsers: true,
               canViewRawLogs: true,
               canViewAnalytics: true,
               canManageSettings: true,
               canExportData: true,
            };
         } else {
            newUserData.permissions = {
               canCreateApiKeys: false,
               canManageUsers: false,
               canViewRawLogs: true,
               canViewAnalytics: true,
               canManageSettings: false,
               canExportData: false,
            };
         }

         const newUser = await this.userRepo.create(newUserData);
         logger.info(
            `Client user created successfully with username : ${newUser.username} for clientId: ${clientId} by user: ${createdBy.id}`,
         );
         return this.formatUserResponseWithoutPassword(newUser);
      } catch (error) {
         logger.error("Error creating client user", { error, clientId, userData, createdBy });
         throw error;
      }
   }
}
