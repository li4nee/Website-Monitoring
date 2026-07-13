import { MongoUserRepo } from "../../auth/repos/user.repo";
import { ClientController } from "../controllers/client.controller";
import { MongoApiKeyRepo } from "../repos/apikey.repo";
import { MongoClientRepo } from "../repos/client.repo";
import { ClientService } from "../services/client.service";
import { ApiKeyService } from "../services/apiKey.service";
import { IClientService } from "../contracts/IClientService.contract";
import { IApiKeyService } from "../contracts/IApiKeyService.contract";
import { ClientBaseRepo } from "../repos/clientBase.repo";
import { Client } from "../../../shared/infra/db/mongo/models/client.model";
import { ApiKeyWithId } from "../../../shared/infra/db/mongo/models/apiKeys.model";
import { UserWithId } from "../../../shared/infra/db/mongo/models/user.model";
import { UserBaseRepo } from "../../auth/repos/userBase.repo";
import { ApiKeyBaseRepo } from "../repos/apiKeyBase.repo";

export interface ClientDependencies {
   repositories: {
      clientRepo: ClientBaseRepo<Client>;
      apiKeyRepo: ApiKeyBaseRepo<ApiKeyWithId>;
      userRepo: UserBaseRepo<UserWithId>;
   };
   services: {
      clientService: IClientService;
      apiKeyService: IApiKeyService;
   };
   controllers: {
      clientController: ClientController;
   };
}
class ClientDependeniesContainer {
   static init(): ClientDependencies {
      const repositories = {
         clientRepo: new MongoClientRepo(),
         apiKeyRepo: new MongoApiKeyRepo(),
         userRepo: new MongoUserRepo(),
      };
      const services = {
         clientService: new ClientService(repositories.clientRepo, repositories.userRepo, repositories.apiKeyRepo),
         apiKeyService: new ApiKeyService(repositories.apiKeyRepo, repositories.clientRepo),
      };
      const controllers = {
         clientController: new ClientController(services.clientService, services.apiKeyService),
      };
      return {
         repositories,
         services,
         controllers,
      };
   }
}

export { ClientDependeniesContainer };
export default ClientDependeniesContainer;
