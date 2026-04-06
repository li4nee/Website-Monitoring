import logger from "../../../shared/config/logger.config";
import { ApiKey } from "../../../shared/models/apiKeys.model";
import { Client } from "../../../shared/models/client.model";
import { User } from "../../../shared/models/user.model";
import { ResourceNotInitializedError } from "../../../shared/typings/error.typings";
import { UserBaseRepo } from "../../auth/repos/userBase.repo";
import { ApiKeyBaseRepo } from "../repos/apiKeyBase.repo";
import { ClientBaseRepo } from "../repos/clientBase.repo";

export class ClientService {
   protected clientRepo: ClientBaseRepo<Client>;
   protected apiKeyRepo: ApiKeyBaseRepo<ApiKey>;
   protected userRepo: UserBaseRepo<User>;

   constructor(clientRepo: ClientBaseRepo<Client>, apiKeyRepo: ApiKeyBaseRepo<ApiKey>, userRepo: UserBaseRepo<User>) {
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

//    async createClient(clientData: Partial<Client>, createdBy: string): Promise<Client> {
//     try {
//         const clientToCreate: Partial<Client> = {
//             name: clientData.name,
//             email: clientData.email,
//             slug: clientData.slug,
//             description: clientData.description || "",
//             website: clientData.website || "",

//         }
//     } catch (error) {
//         logger.error("Error creating client", { error, clientData, createdBy });
//         throw error;
//     }
//    }
}
