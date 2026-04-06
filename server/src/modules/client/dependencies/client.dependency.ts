import { ClientController } from "../controllers/client.controller";
import { MongoClientRepo } from "../repos/client.repo";
import { ClientService } from "../services/client.service";

class ClientDependeniesContainer {
   static init() {
      const repositories = {
         clientRepository: new MongoClientRepo(),
      };
      const services = {
        clientService: new ClientService(),
      };
      const controllers = {
        clientController: new ClientController(),
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
