import { NextFunction, Router } from "express";
import AuthDependenciesContainer from "../dependencies/auth.dependecy";
import { validateBody } from "../../../shared/middleware/zodValidators.middleware";
import { RegistrationDTO, SuperAdminOnboardingDto } from "../dtos/onboarding.dto";
import { Response } from "express";
import { Request } from "express";
import { CentralizedRequestLogger } from "../../../shared/middleware/requestLogger.middleware";
import { authenticate } from "../../../shared/middleware/authenticate.middleware";
import { authorize } from "../../../shared/middleware/authorize.middleware";
import { USER_ROLE } from "../../../shared/typings/auth.typings";
import { LoginDTO } from "../dtos/sessionManagement.dto";
import { authRateLimiter } from "../../../shared/infra/resilience/rateLimit.infra";

const router = Router();
const { controllers } = AuthDependenciesContainer;
const { authController } = controllers;

router.post(
   "/onboard-super-admin",
   authRateLimiter,
   validateBody(SuperAdminOnboardingDto),
   (req: Request, res: Response, next: NextFunction) => authController.onboardSuperAdmin(req, res, next),
);

router.post(
   "/register",
   authenticate,
   authorize([USER_ROLE.SUPER_ADMIN]),
   validateBody(RegistrationDTO),
   (req: Request, res: Response, next: NextFunction) => authController.register(req, res, next),
);

router.post("/login", authRateLimiter, validateBody(LoginDTO), (req: Request, res: Response, next: NextFunction) =>
   authController.login(req, res, next),
);

router.get("/profile", authenticate, (req: Request, res: Response, next: NextFunction) => authController.profile(req, res, next));

router.post("/logout", authenticate, (req: Request, res: Response, next: NextFunction) => authController.logout(req, res, next));

export default router;
