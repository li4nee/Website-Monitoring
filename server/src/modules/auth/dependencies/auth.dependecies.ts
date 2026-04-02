import { AuthController } from "../controllers/auth.controller";
import { AuthService } from "../services/auth.service";
import { MongoUserRepo } from "../repos/user.repo";

class AuthDependenciesContainer {
   static init() {
      const repositories = {
         userRespository: new MongoUserRepo(),
      };
      const services = {
         authService: new AuthService(repositories.userRespository),
      };
      const controllers = {
         authController: new AuthController(services.authService),
      };
      return {
         repositories,
         services,
         controllers,
      };
   }
}

const initialized = AuthDependenciesContainer.init();
export { AuthDependenciesContainer };
export default initialized;
