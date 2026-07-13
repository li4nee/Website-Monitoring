import { Types } from "mongoose";
import logger from "../../../shared/config/logger.config";
import {
   InvalidInputError,
   PermissionNotGranted,
   ResourceNotFoundError,
   ResourceNotInitializedError,
} from "../../../shared/typings/error.typings";
import { UserBaseRepo } from "../../auth/repos/userBase.repo";
import { CreateClientDTOType } from "../dtos/createClient.dto";
import { UpdateClientDTOType } from "../dtos/updateClient.dto";
import { UpdateUserPermissionsDTOType } from "../dtos/updateUser.dto";
import { ClientBaseRepo } from "../repos/clientBase.repo";
import { USER_ROLE, UserInsideAuthorizedRequest } from "../../../shared/typings/auth.typings";
import { AuthorizationUtils } from "../../../shared/utils/authorization.utils";
import { CreateClientUserDTOType } from "../dtos/createClientUser.dto";
import { Client, ClientWithId } from "../../../shared/infra/db/mongo/models/client.model";
import { User, UserWithId } from "../../../shared/infra/db/mongo/models/user.model";
import { AuditLogger } from "../../../shared/utils/auditLogger.utils";
import { issueAndSendVerificationEmail } from "../../../shared/utils/emailVerification.utils";
import { ApiKeyBaseRepo } from "../repos/apiKeyBase.repo";
import { ApiKeyWithId } from "../../../shared/infra/db/mongo/models/apiKeys.model";
import { ApiKeyCache } from "../../../shared/infra/cache/apiKeyCache";
import { SignupDTOType } from "../dtos/signup.dto";
export class ClientService {
   protected clientRepo: ClientBaseRepo<Client>;
   protected apiKeyRepo: ApiKeyBaseRepo<ApiKeyWithId>;
   protected userRepo: UserBaseRepo<UserWithId>;

   constructor(clientRepo: ClientBaseRepo<Client>, userRepo: UserBaseRepo<UserWithId>, apiKeyRepo: ApiKeyBaseRepo<ApiKeyWithId>) {
      if (!clientRepo) {
         throw new ResourceNotInitializedError("Client repository must be provided to ClientService");
      }
      if (!apiKeyRepo) {
         throw new ResourceNotInitializedError("API Key repository must be provided to ClientService");
      }
      if (!userRepo) {
         throw new ResourceNotInitializedError("User repository must be provided to ClientService");
      }
      this.clientRepo = clientRepo;
      this.apiKeyRepo = apiKeyRepo;
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
         // This method is only reached through a super_admin-only route (see clientAdmin.route.ts).
         // The repo's `Client` type does not expose `_id`, even though the underlying
         // document has one, so we use the slug here as a stable, unique, type-safe identifier.
         AuditLogger.log({
            action: "client.created",
            actorId: createdBy,
            actorRole: USER_ROLE.SUPER_ADMIN,
            targetType: "client",
            targetId: newClient.slug,
            metadata: { name: newClient.name, slug: newClient.slug },
         });
         return newClient;
      } catch (error) {
         logger.error("Error creating client", { error, clientData, createdBy });
         throw error;
      }
   }

   /**
    * Public signup that creates a new client and its first user.
    */
   async signup(data: SignupDTOType): Promise<{ client: Client; user: Omit<User, "password" | "trash" | "isActive"> }> {
      try {
         const slug = this.generateSlug(data.companyName);

         const existingClient = await this.clientRepo.findBySlug(slug, true);
         if (existingClient) {
            throw new InvalidInputError("A company with this name is already registered. Please choose a different name.");
         }

         await this.checkIfClientUserExistsAndThrowError(data.username, data.email);

         const newUserId = new Types.ObjectId();

         const newClient = await this.clientRepo.create({
            name: data.companyName,
            email: data.email,
            website: data.companyWebsite || "",
            slug,
            createdBy: newUserId,
         });

         const clientId = (newClient as unknown as ClientWithId)._id;

         try {
            const newUser = await this.userRepo.create({
               _id: newUserId,
               username: data.username,
               email: data.email,
               password: data.password,
               role: USER_ROLE.CLIENT_ADMIN,
               clientId,
               permissions: {
                  canCreateApiKeys: true,
                  canManageUsers: true,
                  canViewRawLogs: true,
                  canViewAnalytics: true,
                  canManageSettings: true,
                  canExportData: true,
               },
            } as Partial<User> & { _id: Types.ObjectId });

            void issueAndSendVerificationEmail(newUser);

            logger.info(`New company signed up: ${newClient.slug}, admin: ${newUser.username}`);
            AuditLogger.log({
               action: "client.signup",
               actorId: newUserId.toString(),
               actorRole: USER_ROLE.CLIENT_ADMIN,
               clientId: clientId.toString(),
               targetType: "client",
               targetId: newClient.slug,
               metadata: { name: newClient.name, slug: newClient.slug },
            });

            return { client: newClient, user: this.formatUserResponseWithoutPassword(newUser) };
         } catch (userCreateError) {
            // Roll back the orphaned client if the admin user couldn't be created
            // (e.g. an email/username collision that slipped past the check above).
            await this.clientRepo.delete(clientId.toString());
            throw userCreateError;
         }
      } catch (error) {
         logger.error("Error during company signup", { error, companyName: data.companyName, email: data.email });
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

         void issueAndSendVerificationEmail(newUser);
         AuditLogger.log({
            action: "user.created",
            actorId: createdBy.id,
            actorRole: createdBy.role,
            clientId,
            targetType: "user",
            targetId: newUser._id?.toString(),
            metadata: { username: newUser.username, role: newUser.role },
         });
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

   async updateClient(clientId: string, data: UpdateClientDTOType, requestedBy: UserInsideAuthorizedRequest): Promise<Client> {
      try {
         this.requireSuperAdmin(requestedBy);
         const updated = await this.clientRepo.update(clientId, data as any);
         if (!updated) throw new ResourceNotFoundError("Client not found.");
         logger.info(`Client updated: ${clientId} by user: ${requestedBy.id}`);
         AuditLogger.log({
            action: "client.updated",
            actorId: requestedBy.id,
            actorRole: requestedBy.role,
            clientId,
            targetType: "client",
            targetId: clientId,
            metadata: { fields: Object.keys(data) },
         });
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
         if (user.clientId?.toString() !== clientId) throw new PermissionNotGranted("User does not belong to this client.");

         const base = user.permissions ?? {
            canCreateApiKeys: false,
            canManageUsers: false,
            canViewRawLogs: false,
            canViewAnalytics: false,
            canManageSettings: false,
            canExportData: false,
         };
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
         AuditLogger.log({
            action: "user.permissions_updated",
            actorId: requestedBy.id,
            actorRole: requestedBy.role,
            clientId,
            targetType: "user",
            targetId: userId,
            metadata: { permissions: merged },
         });
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
         if (user.clientId?.toString() !== clientId) throw new PermissionNotGranted("User does not belong to this client.");

         const updated = await this.userRepo.update(userId, { isActive });
         if (!updated) throw new ResourceNotFoundError("User not found.");
         logger.info(
            `User ${isActive ? "activated" : "deactivated"}: ${userId} for clientId: ${clientId} by user: ${requestedBy.id}`,
         );
         AuditLogger.log({
            action: isActive ? "user.activated" : "user.deactivated",
            actorId: requestedBy.id,
            actorRole: requestedBy.role,
            clientId,
            targetType: "user",
            targetId: userId,
         });
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

         if (!isActive) {
            // Cached API-key lookups embed client.isActive — without this, a
            // deactivated client's keys would keep validating until the cache
            // TTL naturally expires instead of stopping immediately.
            void this.invalidateApiKeyCacheForClient(clientId);
         }

         logger.info(`Client ${isActive ? "activated" : "deactivated"}: ${clientId} by user: ${requestedBy.id}`);
         AuditLogger.log({
            action: isActive ? "client.activated" : "client.deactivated",
            actorId: requestedBy.id,
            actorRole: requestedBy.role,
            clientId,
            targetType: "client",
            targetId: clientId,
         });
         return updated;
      } catch (error) {
         logger.error("Error setting client active status", { error, clientId, isActive });
         throw error;
      }
   }

   private async invalidateApiKeyCacheForClient(clientId: string): Promise<void> {
      try {
         const keyValueHashes = await this.apiKeyRepo.findKeyValuesByClientId(clientId, true);
         await Promise.all(keyValueHashes.map((hash) => ApiKeyCache.invalidate(hash)));
      } catch (error) {
         logger.error("Error invalidating API key cache for client", { error, clientId });
      }
   }
}
