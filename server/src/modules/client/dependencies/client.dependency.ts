import { MongoUserRepo } from "../../auth/repos/user.repo";
import { ClientController } from "../controllers/client.controller";
import { MongoApiKeyRepo } from "../repos/apikey.repo";
import { MongoClientRepo } from "../repos/client.repo";
import { ClientService } from "../services/client.service";
import { AuthService } from "../../auth/services/auth.service";
import { ApiKeyService } from "../services/apiKey.service";

class ClientDependeniesContainer {
   static init() {
      const repositories = {
         clientRepo: new MongoClientRepo(),
         apiKeyRepo: new MongoApiKeyRepo(),
         userRepo: new MongoUserRepo(),
      };
      const services = {
         clientService: new ClientService(repositories.clientRepo, repositories.userRepo),
         authService: new AuthService(repositories.userRepo),
         apiKeyService: new ApiKeyService(repositories.apiKeyRepo, repositories.clientRepo),
      };
      const controllers = {
         clientController: new ClientController(services.authService, services.clientService, services.apiKeyService),
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
