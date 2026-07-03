import { Types } from "mongoose";
import logger from "../../../shared/config/logger.config";
import { InvalidInputError, PermissionNotGranted, ResourceNotFoundError, ResourceNotInitializedError } from "../../../shared/typings/error.typings";
import { UserBaseRepo } from "../../auth/repos/userBase.repo";
import { CreateClientDTOType } from "../dtos/createClient.dto";
import { UpdateClientDTOType } from "../dtos/updateClient.dto";
import { UpdateUserPermissionsDTOType } from "../dtos/updateUser.dto";
import { ClientBaseRepo } from "../repos/clientBase.repo";
import { USER_ROLE, UserInsideAuthorizedRequest } from "../../../shared/typings/auth.typings";
import { AuthorizationUtils } from "../../../shared/utils/authorization.utils";
import { CreateClientUserDTOType } from "../dtos/createClientUser.dto";
import { Client } from "../../../shared/infra/db/mongo/models/client.model";
import { User, UserWithId } from "../../../shared/infra/db/mongo/models/user.model";
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

   private requireSuperAdmin(user: UserInsideAuthorizedRequest): void {
      if (user.role !== USER_ROLE.SUPER_ADMIN) {
         throw new PermissionNotGranted("Only Super Admins can perform this action.");
      }
   }

   private requireAdminForClient(user: UserInsideAuthorizedRequest, clientId: string): void {
      if (user.role === USER_ROLE.SUPER_ADMIN) return;
      if (user.role === USER_ROLE.CLIENT_ADMIN && user.clientId === clientId && user.permissions.canManageUsers) return;
      throw new PermissionNotGranted("You do not have permission to manage users for this client.");
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

   async getClient(clientId: string, requestedBy: UserInsideAuthorizedRequest): Promise<Client> {
      try {
         if (requestedBy.role !== USER_ROLE.SUPER_ADMIN) {
            if (requestedBy.clientId !== clientId) {
               throw new PermissionNotGranted("You are not authorized to view this client.");
            }
         }
         const client = await this.clientRepo.findById(clientId, false);
         if (!client) throw new ResourceNotFoundError("Client not found.");
         logger.info(`Client retrieved: ${clientId} by user: ${requestedBy.id}`);
         return client;
      } catch (error) {
         logger.error("Error retrieving client", { error, clientId });
         throw error;
      }
   }

   async listClients(
      requestedBy: UserInsideAuthorizedRequest,
      limit: number,
      cursor?: string,
   ): Promise<{ data: Client[]; nextCursor?: string }> {
      try {
         this.requireSuperAdmin(requestedBy);
         const safeLimit = Math.min(Math.max(limit, 1), 100);
         const result = await this.clientRepo.findAll({}, { limit: safeLimit, cursor });
         logger.info(`Clients listed by user: ${requestedBy.id}`);
         return result;
      } catch (error) {
         logger.error("Error listing clients", { error });
         throw error;
      }
   }

   async updateClient(
      clientId: string,
      data: UpdateClientDTOType,
      requestedBy: UserInsideAuthorizedRequest,
   ): Promise<Client> {
      try {
         this.requireSuperAdmin(requestedBy);
         const updated = await this.clientRepo.update(clientId, data as any);
         if (!updated) throw new ResourceNotFoundError("Client not found.");
         logger.info(`Client updated: ${clientId} by user: ${requestedBy.id}`);
         return updated;
      } catch (error) {
         logger.error("Error updating client", { error, clientId });
         throw error;
      }
   }

   async listUsersForClient(
      clientId: string,
      requestedBy: UserInsideAuthorizedRequest,
      limit: number,
      cursor?: string,
   ): Promise<{ data: Omit<UserWithId, "password">[]; nextCursor?: string }> {
      try {
         this.requireAdminForClient(requestedBy, clientId);
         const client = await this.clientRepo.findById(clientId, true);
         if (!client) throw new ResourceNotFoundError("Client not found.");
         const safeLimit = Math.min(Math.max(limit, 1), 100);
         const result = await this.userRepo.findByClientId(clientId, safeLimit, cursor);
         logger.info(`Users listed for clientId: ${clientId} by user: ${requestedBy.id}`);
         return result as { data: Omit<UserWithId, "password">[]; nextCursor?: string };
      } catch (error) {
         logger.error("Error listing users for client", { error, clientId });
         throw error;
      }
   }

   async updateUserPermissions(
      clientId: string,
      userId: string,
      permissions: UpdateUserPermissionsDTOType,
      requestedBy: UserInsideAuthorizedRequest,
   ): Promise<Omit<User, "password" | "trash" | "isActive">> {
      try {
         this.requireAdminForClient(requestedBy, clientId);
         const user = await this.userRepo.findById(userId);
         if (!user) throw new ResourceNotFoundError("User not found.");
         if (user.clientId?.toString() !== clientId)
            throw new PermissionNotGranted("User does not belong to this client.");

         const base = user.permissions ?? { canCreateApiKeys: false, canManageUsers: false, canViewRawLogs: false, canViewAnalytics: false, canManageSettings: false, canExportData: false };
         const merged = {
            canCreateApiKeys: permissions.canCreateApiKeys ?? base.canCreateApiKeys,
            canManageUsers: permissions.canManageUsers ?? base.canManageUsers,
            canViewRawLogs: permissions.canViewRawLogs ?? base.canViewRawLogs,
            canViewAnalytics: permissions.canViewAnalytics ?? base.canViewAnalytics,
            canManageSettings: permissions.canManageSettings ?? base.canManageSettings,
            canExportData: permissions.canExportData ?? base.canExportData,
         };
         const updated = await this.userRepo.update(userId, { permissions: merged });
         if (!updated) throw new ResourceNotFoundError("User not found.");
         logger.info(`User permissions updated: ${userId} for clientId: ${clientId} by user: ${requestedBy.id}`);
         return this.formatUserResponseWithoutPassword(updated);
      } catch (error) {
         logger.error("Error updating user permissions", { error, clientId, userId });
         throw error;
      }
   }

   async setUserActive(
      clientId: string,
      userId: string,
      isActive: boolean,
      requestedBy: UserInsideAuthorizedRequest,
   ): Promise<Omit<User, "password" | "trash" | "isActive">> {
      try {
         this.requireAdminForClient(requestedBy, clientId);
         const user = await this.userRepo.findById(userId);
         if (!user) throw new ResourceNotFoundError("User not found.");
         if (user.clientId?.toString() !== clientId)
            throw new PermissionNotGranted("User does not belong to this client.");

         const updated = await this.userRepo.update(userId, { isActive });
         if (!updated) throw new ResourceNotFoundError("User not found.");
         logger.info(`User ${isActive ? "activated" : "deactivated"}: ${userId} for clientId: ${clientId} by user: ${requestedBy.id}`);
         return this.formatUserResponseWithoutPassword(updated);
      } catch (error) {
         logger.error("Error setting user active status", { error, clientId, userId, isActive });
         throw error;
      }
   }

   async setClientActive(clientId: string, isActive: boolean, requestedBy: UserInsideAuthorizedRequest): Promise<Client> {
      try {
         this.requireSuperAdmin(requestedBy);
         const updated = await this.clientRepo.update(clientId, { isActive } as any);
         if (!updated) throw new ResourceNotFoundError("Client not found.");
         logger.info(`Client ${isActive ? "activated" : "deactivated"}: ${clientId} by user: ${requestedBy.id}`);
         return updated;
      } catch (error) {
         logger.error("Error setting client active status", { error, clientId, isActive });
         throw error;
      }
   }
}
