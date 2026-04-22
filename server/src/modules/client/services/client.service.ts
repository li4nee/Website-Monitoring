import { Types } from "mongoose";
import logger from "../../../shared/config/logger.config";
import { ApiKey, ApiKeyWithId } from "../../../shared/models/apiKeys.model";
import { Client, ClientDocument } from "../../../shared/models/client.model";
import { User, UserDocument, UserWithId } from "../../../shared/models/user.model";
import { InvalidInputError, PermissionNotGranted, ResourceNotInitializedError } from "../../../shared/typings/error.typings";
import { UserBaseRepo } from "../../auth/repos/userBase.repo";
import { CreateClientDTOType } from "../dtos/createClient.dto";
import { ApiKeyBaseRepo } from "../repos/apiKeyBase.repo";
import { ClientBaseRepo } from "../repos/clientBase.repo";
import { USER_ROLE, UserInsideAuthorizedRequest } from "../../../shared/typings/base.typings";
import { AuthorizationUtils } from "../../../shared/utils/authorization.utils";
import { CreateClientUserDTO, CreateClientUserDTOType } from "../dtos/createClientUser.dto";
import { CreateApiKeyDtoType } from "../dtos/createApiKey.dto";
import crypto from "crypto";
import { CreateApiKeyResponseDto } from "../dtos/createApiKeyResponse.dto";
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

   private generateApiKey() {
      const prefix = "api_key_live";

      const keyId = crypto.randomBytes(8).toString("hex"); // short ID
      const secret = crypto.randomBytes(32).toString("hex"); // actual secret

      return {
         keyId: `${prefix}_${keyId}`,
         keyValue: `${prefix}_${secret}`,
      };
   }

   private hashApiKey(key: string) {
      return crypto.createHash("sha256").update(key).digest("hex");
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

   // /**
   //  * Someone can view the API key in the response only at the time of creation.
   //  * Not saved in the DB plain
   //  */
   // async createApiKeysForClient(
   //    clientId: string,
   //    body: CreateApiKeyDtoType,
   //    createdBy: UserInsideAuthorizedRequest,
   // ): Promise<{ keyId: string; apiKey: string }> {
   //    try {
   //       if (!AuthorizationUtils.canCreateApiKeys(createdBy, clientId))
   //          throw new PermissionNotGranted("Permission denied to create API keys for this client.");

   //       const client = await this.clientRepo.findById(clientId, true);
   //       if (!client) throw new InvalidInputError("Client not found");

   //       const apiKey = this.generateApiKey();
   //       const newApiKey = await this.apiKeyRepo.create({
   //          keyId: apiKey.keyId,
   //          keyValue: this.hashApiKey(apiKey.keyValue),
   //          name: body.name,
   //          description: body.description,
   //          environment: body.environment,
   //          permissions: body.permissions,
   //          security: body.security,
   //          clientId: new Types.ObjectId(clientId),
   //          metaData: {
   //             createdBy: new Types.ObjectId(createdBy.id),
   //             tags: body?.metaData?.tags || [],
   //             purpose: body?.metaData?.purpose || "",
   //          },
   //          expiresAt: body.expiresAt,
   //          rotationWarningPeriod: body.rotationWarningPeriod,
   //       });
   //       logger.info(
   //          `API key created successfully with id : ${newApiKey._id} for clientId: ${clientId} by user: ${createdBy.id}`,
   //       );
   //       return { keyId: apiKey.keyId, apiKey: apiKey.keyValue };
   //    } catch (error) {
   //       logger.error("Error creating API key for client", { error, clientId, createdBy });
   //       throw error;
   //    }
   // }

   // /**
   //  * The actual key values are never returned, only their metadata.
   //  */
   // async getApiKeysForClient(clientId: string, requestedBy: UserInsideAuthorizedRequest): Promise<CreateApiKeyResponseDto[]> {
   //    try {
   //       if (!AuthorizationUtils.canCreateApiKeys(requestedBy, clientId))
   //          throw new PermissionNotGranted("Permission denied to view API keys for this client.");
   //       const client = await this.clientRepo.findById(clientId, true);
   //       if (!client) throw new InvalidInputError("Client not found");

   //       const apiKeys = await this.apiKeyRepo.findByClientId(clientId, true, false);
   //       logger.info(`API keys retrieved successfully for clientId: ${clientId} by user: ${requestedBy.id}`);
   //       return apiKeys.map((apiKey) => {
   //          return new CreateApiKeyResponseDto(apiKey);
   //       });
   //    } catch (error) {
   //       logger.error("Error retrieving API keys for client", { error, clientId, requestedBy });
   //       throw error;
   //    }
   // }

   // async getApiKeyFromId(
   //    clientId: string,
   //    apiKeyId: string,
   //    requestedBy: UserInsideAuthorizedRequest,
   // ): Promise<Omit<ApiKeyWithId, "keyValue">> {
   //    try {
   //       if (!AuthorizationUtils.canCreateApiKeys(requestedBy, clientId))
   //          throw new PermissionNotGranted("Permission denied to view API keys for this client.");
   //       const client = await this.clientRepo.findById(clientId, true);
   //       if (!client) throw new InvalidInputError("Client not found");

   //       const apiKey = await this.apiKeyRepo.findById(apiKeyId, true, false);
   //       if (!apiKey) throw new InvalidInputError("API key not found");
   //       const { keyValue, ...safeapikey } = apiKey;
   //       return safeapikey;
   //    } catch (error) {
   //       logger.error("Error retrieving API key for client", { error, clientId, apiKeyId, requestedBy });
   //       throw error;
   //    }
   // }
}
