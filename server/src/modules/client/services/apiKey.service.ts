import { Types } from "mongoose";
import logger from "../../../shared/config/logger.config";
import {
   InvalidInputError,
   PermissionNotGranted,
   ResourceNotFoundError,
   ResourceNotInitializedError,
} from "../../../shared/typings/error.typings";
import { ApiKeyBaseRepo } from "../repos/apiKeyBase.repo";
import { AuthorizationUtils } from "../../../shared/utils/authorization.utils";
import { CreateApiKeyDtoType } from "../dtos/createApiKey.dto";
import { UserInsideAuthorizedRequest } from "../../../shared/typings/auth.typings";
import crypto from "crypto";
import { CreateApiKeyResponseDto } from "../dtos/createApiKeyResponse.dto";
import { ClientBaseRepo } from "../repos/clientBase.repo";
import { ApiKeyWithId } from "../../../shared/infra/db/mongo/models/apiKeys.model";
import { ClientWithId } from "../../../shared/infra/db/mongo/models/client.model";
import { globalConfig } from "../../../shared/config/global.config";
import { AuditLogger } from "../../../shared/utils/auditLogger.utils";
import { ApiKeyCache, ApiKeyLookupResult } from "../../../shared/infra/cache/apiKeyCache";

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
      // We need this HMAC secret , so that when we change this all the existing API KEY will be invalidated.
      return crypto.createHmac("sha256", globalConfig.apiKey.hmacSecret).update(key).digest("hex");
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
         if (!client) throw new ResourceNotFoundError("Client not found");

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

         // Never include the plaintext/hashed secret in the audit trail — keyId
         // (the public identifier) is enough to correlate this entry later.
         AuditLogger.log({
            action: "api_key.created",
            actorId: createdBy.id,
            actorRole: createdBy.role,
            clientId,
            targetType: "api_key",
            targetId: apiKey.keyId,
            metadata: { name: body.name, environment: body.environment },
         });

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
         if (!client) throw new ResourceNotFoundError("Client not found");

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
         if (!client) throw new ResourceNotFoundError("Client not found");

         const apiKey = await this.apiKeyRepo.findByKeyId(apiKeyId, true, false);
         if (!apiKey) throw new ResourceNotFoundError("API key not found");

         const { keyValue, ...safeapikey } = apiKey;
         return safeapikey;
      } catch (error) {
         logger.error("Error retrieving API key for client", { error, clientId, apiKeyId, requestedBy });
         throw error;
      }
   }

   async revokeApiKey(clientId: string, apiKeyId: string, requestedBy: UserInsideAuthorizedRequest): Promise<void> {
      try {
         if (!AuthorizationUtils.canCreateApiKeys(requestedBy, clientId))
            throw new PermissionNotGranted("Permission denied to revoke API keys for this client.");

         const client = await this.clientRepo.findById(clientId, true);
         if (!client) throw new ResourceNotFoundError("Client not found.");

         const apiKey = await this.apiKeyRepo.findById(apiKeyId, true, false);
         if (!apiKey) throw new ResourceNotFoundError("API key not found.");

         if (apiKey.clientId.toString() !== clientId)
            throw new PermissionNotGranted("This API key does not belong to this client.");

         // Fetched before delete so we have the hash to evict from cache — revoke
         // must not leave a cached copy of the key working until TTL expiry.
         const keyValueHash = await this.apiKeyRepo.findKeyValueById(apiKeyId);

         await this.apiKeyRepo.delete(apiKeyId);
         if (keyValueHash) void ApiKeyCache.invalidate(keyValueHash);

         logger.info(`API key revoked: ${apiKeyId} for clientId: ${clientId} by user: ${requestedBy.id}`);
         AuditLogger.log({
            action: "api_key.revoked",
            actorId: requestedBy.id,
            actorRole: requestedBy.role,
            clientId,
            targetType: "api_key",
            targetId: apiKeyId,
            metadata: { name: apiKey.name },
         });
      } catch (error) {
         logger.error("Error revoking API key", { error, clientId, apiKeyId, requestedBy });
         throw error;
      }
   }

   async getClientFromApiKey(apiKeyValue: string): Promise<ApiKeyLookupResult> {
      const hashedKeyValue = this.hashApiKey(apiKeyValue);

      try {
         const cached = await ApiKeyCache.get(hashedKeyValue);
         if (cached) return cached;

         const apiKeyDoc = await this.apiKeyRepo.findByKeyValue(hashedKeyValue, true, true);

         if (!apiKeyDoc) {
            throw new InvalidInputError("Invalid or expired API key");
         }

         if (!apiKeyDoc.clientId) {
            throw new ResourceNotFoundError("API key not linked to any client");
         }

         const client = await this.clientRepo.findById(apiKeyDoc.clientId.toString(), false);

         if (!client) {
            throw new ResourceNotFoundError("Client not found");
         }

         const result: ApiKeyLookupResult = {
            client: {
               id: client._id.toString(),
               name: client.name,
               slug: client.slug,
               isActive: client.isActive,
            },
            apiKey: {
               id: apiKeyDoc._id.toString(),
               keyId: apiKeyDoc.keyId,
               name: apiKeyDoc.name,
               permissions: {
                  writeAccess: apiKeyDoc.permissions?.writeAccess ?? false,
                  readAccess: apiKeyDoc.permissions?.readAccess ?? false,
               },
            },
         };

         // Only successful lookups are cached — see ApiKeyCache's doc comment on why.
         void ApiKeyCache.set(hashedKeyValue, result);

         return result;
      } catch (error) {
         logger.error("Error retrieving client from API key", { error });
         throw error;
      }
   }
}
