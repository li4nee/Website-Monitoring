import { NextFunction, Router } from "express";
import AuthDependenciesContainer from "../dependencies/auth.dependecy";
import ClientDependeniesContainer from "../../client/dependencies/client.dependency";
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
import { ChangePasswordDTO } from "../dtos/changePassword.dto";
import { EmailOnlyDTO } from "../dtos/emailOnly.dto";
import { VerifyEmailDTO } from "../dtos/verifyEmail.dto";
import { ResetPasswordDTO } from "../dtos/resetPassword.dto";
import { SignupDTO } from "../../client/dtos/signup.dto";

const router = Router();
const { authController } = AuthDependenciesContainer.init().controllers;
const { clientController } = ClientDependeniesContainer.init().controllers;

router.post(
   "/onboard-super-admin",
   authRateLimiter,
   validateBody(SuperAdminOnboardingDto),
   (req: Request, res: Response, next: NextFunction) => authController.onboardSuperAdmin(req, res, next),
);

/**
 * Public signup for new companies.
 * Creates the tenant and its first admin user.
 */
router.post("/signup", authRateLimiter, validateBody(SignupDTO), (req: Request, res: Response, next: NextFunction) =>
   clientController.signup(req, res, next),
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

router.patch(
   "/change-password",
   authenticate,
   validateBody(ChangePasswordDTO),
   (req: Request, res: Response, next: NextFunction) => authController.changePassword(req, res, next),
);

router.post(
   "/resend-verification-email",
   authRateLimiter,
   validateBody(EmailOnlyDTO),
   (req: Request, res: Response, next: NextFunction) => authController.resendVerificationEmail(req, res, next),
);

router.post("/verify-email", authRateLimiter, validateBody(VerifyEmailDTO), (req: Request, res: Response, next: NextFunction) =>
   authController.verifyEmail(req, res, next),
);

router.post("/forgot-password", authRateLimiter, validateBody(EmailOnlyDTO), (req: Request, res: Response, next: NextFunction) =>
   authController.forgotPassword(req, res, next),
);

router.post("/reset-password", authRateLimiter, validateBody(ResetPasswordDTO), (req: Request, res: Response, next: NextFunction) =>
   authController.resetPassword(req, res, next),
);

export default router;
