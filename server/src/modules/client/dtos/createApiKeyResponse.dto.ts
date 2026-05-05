import { ApiKeyWithId } from "../../../shared/infra/db/mongo/models/apiKeys.model";

export class CreateApiKeyResponseDto {
   _id: string;
   keyId: string;
   name: string;
   environment: string;
   isActive: boolean;
   clientId: any;

   constructor(apiKeyDoc: ApiKeyWithId) {
      this._id = apiKeyDoc._id.toString();
      this.keyId = apiKeyDoc.keyId;
      this.name = apiKeyDoc.name;
      this.environment = apiKeyDoc.environment;
      this.isActive = apiKeyDoc.isActive;
      this.clientId = apiKeyDoc.clientId;
   }
}
