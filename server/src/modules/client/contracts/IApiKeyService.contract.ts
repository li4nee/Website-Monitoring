import { ApiKeyWithId } from "../../../shared/infra/db/mongo/models/apiKeys.model";
import { CreateApiKeyDtoType } from "../dtos/createApiKey.dto";
import { CreateApiKeyResponseDto } from "../dtos/createApiKeyResponse.dto";
import { UserInsideAuthorizedRequest } from "../../../shared/typings/auth.typings";
import { ApiKeyLookupResult } from "../../../shared/infra/cache/apiKeyCache";

export interface IApiKeyService {
   createApiKeysForClient(
      clientId: string,
      body: CreateApiKeyDtoType,
      createdBy: UserInsideAuthorizedRequest,
   ): Promise<{ keyId: string; apiKey: string }>;

   getApiKeysForClient(clientId: string, requestedBy: UserInsideAuthorizedRequest): Promise<CreateApiKeyResponseDto[]>;

   getApiKeyFromId(
      clientId: string,
      apiKeyId: string,
      requestedBy: UserInsideAuthorizedRequest,
   ): Promise<Omit<ApiKeyWithId, "keyValue">>;

   getClientFromApiKey(apiKeyValue: string): Promise<ApiKeyLookupResult>;

   revokeApiKey(clientId: string, apiKeyId: string, requestedBy: UserInsideAuthorizedRequest): Promise<void>;
}
