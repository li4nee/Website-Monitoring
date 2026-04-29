import { Types } from "mongoose";
import { ApiKeyWithId } from "../../../shared/models/apiKeys.model";
import { CreateApiKeyDtoType } from "../dtos/createApiKey.dto";
import { CreateApiKeyResponseDto } from "../dtos/createApiKeyResponse.dto";
import { UserInsideAuthorizedRequest } from "../../../shared/typings/base.typings";

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

   getClientFromApiKey(apiKeyValue: string): Promise<{
      client: { _id: Types.ObjectId; name: string; slug: string; isActive: boolean };
      apiKeyDoc: ApiKeyWithId;
   }>;
}
