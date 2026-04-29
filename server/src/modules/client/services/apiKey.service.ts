import { Types } from "mongoose";
import logger from "../../../shared/config/logger.config";
import { ApiKeyWithId } from "../../../shared/models/apiKeys.model";
import { InvalidInputError, PermissionNotGranted, ResourceNotInitializedError } from "../../../shared/typings/error.typings";
import { ApiKeyBaseRepo } from "../repos/apiKeyBase.repo";
import { AuthorizationUtils } from "../../../shared/utils/authorization.utils";
import { CreateApiKeyDtoType } from "../dtos/createApiKey.dto";
import { UserInsideAuthorizedRequest } from "../../../shared/typings/base.typings";
import crypto from "crypto";
import { CreateApiKeyResponseDto } from "../dtos/createApiKeyResponse.dto";
import { ClientBaseRepo } from "../repos/clientBase.repo";
import { Client, ClientWithId } from "../../../shared/models/client.model";

export class ApiKeyService {
   protected apiKeyRepo: ApiKeyBaseRepo<ApiKeyWithId>;
   protected clientRepo: ClientBaseRepo<ClientWithId>;

   constructor(apiKeyRepo: ApiKeyBaseRepo<ApiKeyWithId>, clientRepo: ClientBaseRepo<ClientWithId>) {
      if (!apiKeyRepo) {
         throw new ResourceNotInitializedError("API Key repository must be provided");
      }
      if (!clientRepo) {
         throw new ResourceNotInitializedError("Client repository must be provided");
      }
      this.apiKeyRepo = apiKeyRepo;
      this.clientRepo = clientRepo;
   }

   private generateApiKey() {
      const prefix = "api_key_live";

      const keyId = crypto.randomBytes(8).toString("hex");
      const secret = crypto.randomBytes(32).toString("hex");

      return {
         keyId: `${prefix}_${keyId}`,
         keyValue: `${secret}`,
      };
   }

   private hashApiKey(key: string) {
      return crypto.createHash("sha256").update(key).digest("hex");
   }

   /**
    *
    * @param clientId
    * @param body
    * @param createdBy
    * Only get the api key value once.
    */
   async createApiKeysForClient(
      clientId: string,
      body: CreateApiKeyDtoType,
      createdBy: UserInsideAuthorizedRequest,
   ): Promise<{ keyId: string; apiKey: string }> {
      try {
         if (!AuthorizationUtils.canCreateApiKeys(createdBy, clientId))
            throw new PermissionNotGranted("Permission denied to create API keys for this client.");

         const client = await this.clientRepo.findById(clientId, true);
         if (!client) throw new InvalidInputError("Client not found");

         const apiKey = this.generateApiKey();

         const newApiKey = await this.apiKeyRepo.create({
            keyId: apiKey.keyId,
            keyValue: this.hashApiKey(apiKey.keyValue),
            name: body.name,
            description: body.description,
            environment: body.environment,
            permissions: body.permissions,
            security: body.security,
            clientId: new Types.ObjectId(clientId),
            metaData: {
               createdBy: new Types.ObjectId(createdBy.id),
               tags: body?.metaData?.tags || [],
               purpose: body?.metaData?.purpose || "",
            },
            expiresAt: body.expiresAt,
            rotationWarningPeriod: body.rotationWarningPeriod,
         });

         logger.info(
            `API key created successfully with id : ${newApiKey._id} for clientId: ${clientId} by user: ${createdBy.id}`,
         );

         return { keyId: apiKey.keyId, apiKey: apiKey.keyValue };
      } catch (error) {
         logger.error("Error creating API key for client", { error, clientId, createdBy });
         throw error;
      }
   }

   async getApiKeysForClient(clientId: string, requestedBy: UserInsideAuthorizedRequest): Promise<CreateApiKeyResponseDto[]> {
      try {
         if (!AuthorizationUtils.canCreateApiKeys(requestedBy, clientId))
            throw new PermissionNotGranted("Permission denied to view API keys for this client.");

         const client = await this.clientRepo.findById(clientId, true);
         if (!client) throw new InvalidInputError("Client not found");

         const apiKeys = await this.apiKeyRepo.findByClientId(clientId, true, false);

         logger.info(`API keys retrieved successfully for clientId: ${clientId} by user: ${requestedBy.id}`);

         return apiKeys.map((apiKey) => new CreateApiKeyResponseDto(apiKey));
      } catch (error) {
         logger.error("Error retrieving API keys for client", { error, clientId, requestedBy });
         throw error;
      }
   }

   async getApiKeyFromId(
      clientId: string,
      apiKeyId: string,
      requestedBy: UserInsideAuthorizedRequest,
   ): Promise<Omit<ApiKeyWithId, "keyValue">> {
      try {
         if (!AuthorizationUtils.canCreateApiKeys(requestedBy, clientId))
            throw new PermissionNotGranted("Permission denied to view API keys for this client.");

         const client = await this.clientRepo.findById(clientId, true);
         if (!client) throw new InvalidInputError("Client not found");

         const apiKey = await this.apiKeyRepo.findByKeyId(apiKeyId, true, false);
         if (!apiKey) throw new InvalidInputError("API key not found");

         const { keyValue, ...safeapikey } = apiKey;
         return safeapikey;
      } catch (error) {
         logger.error("Error retrieving API key for client", { error, clientId, apiKeyId, requestedBy });
         throw error;
      }
   }

   async getClientFromApiKey(
      apiKeyValue: string,
   ): Promise<{
      client: { _id: Types.ObjectId; name: string; slug: string; isActive: boolean };
      apiKeyDoc: ApiKeyWithId;
   }> {
      try {
         const hashedKeyValue = this.hashApiKey(apiKeyValue);

         const apiKeyDoc = await this.apiKeyRepo.findByKeyValue(hashedKeyValue, true, true);

         if (!apiKeyDoc) {
            throw new InvalidInputError("Invalid or expired API key");
         }

         if (!apiKeyDoc.clientId) {
            throw new InvalidInputError("API key not linked to client");
         }

         const client = await this.clientRepo.findById(apiKeyDoc.clientId.toString(), false);

         if (!client) {
            throw new InvalidInputError("Client not found");
         }

         const safeClient: { _id: Types.ObjectId; name: string; slug: string; isActive: boolean } = {
            _id: client._id,
            name: client.name,
            slug: client.slug,
            isActive: client.isActive,
         };

         return { client: safeClient, apiKeyDoc };
      } catch (error) {
         logger.error("Error retrieving client from API key", {
            error,
            apiKeyValue,
         });
         throw error;
      }
   }
}
