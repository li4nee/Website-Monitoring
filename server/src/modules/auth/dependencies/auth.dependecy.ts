import { AuthController } from "../controllers/auth.controller";
import { AuthService } from "../services/auth.service";
import { MongoUserRepo } from "../repos/user.repo";
import { UserBaseRepo } from "../repos/userBase.repo";
import { IAuthService } from "../contracts/IAuthService.contract";
import { UserWithId } from "../../../shared/infra/db/mongo/models/user.model";

export interface AuthDependencies {
   repositories: { userRepository: UserBaseRepo<UserWithId> };
   services: { authService: IAuthService };
   controllers: { authController: AuthController };
}

class AuthDependenciesContainer {
   static init(): AuthDependencies {
      const repositories = {
         userRepository: new MongoUserRepo(),
      };
      const services = {
         authService: new AuthService(repositories.userRepository),
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
