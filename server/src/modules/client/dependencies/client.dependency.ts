import { MongoUserRepo } from "../../auth/repos/user.repo";
import { ClientController } from "../controllers/client.controller";
import { MongoApiKeyRepo } from "../repos/apikey.repo";
import { MongoClientRepo } from "../repos/client.repo";
import { ClientService } from "../services/client.service";
import { ApiKeyService } from "../services/apiKey.service";
import { IClientService } from "../contracts/IClientService.contract";
import { IApiKeyService } from "../contracts/IApiKeyService.contract";
import { ClientBaseRepo } from "../repos/clientBase.repo";
import { Client } from "../../../shared/models/client.model";
import { ApiKeyBaseRepo } from "../repos/apiKeyBase.repo";
import { ApiKeyWithId } from "../../../shared/models/apiKeys.model";
import { UserBaseRepo } from "../../auth/repos/userBase.repo";
import { UserWithId } from "../../../shared/models/user.model";

export interface ClientDependencies {
   repositories: {
      clientRepo: ClientBaseRepo<Client>;
      apiKeyRepo: ApiKeyBaseRepo<ApiKeyWithId>;
      userRepo: UserBaseRepo<UserWithId>;
   };
   services: {
      clientService: IClientService
      apiKeyService: IApiKeyService
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
         clientService: new ClientService(repositories.clientRepo, repositories.userRepo),
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

const initialized = ClientDependeniesContainer.init();
export { ClientDependeniesContainer };
export default initialized;
