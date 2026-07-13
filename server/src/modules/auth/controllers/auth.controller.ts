import { AuthorizedRequest } from "../../../shared/typings/auth.typings";
import { PermissionNotGranted, ResourceNotInitializedError } from "../../../shared/typings/error.typings";
import { CookieUtils } from "../../../shared/utils/cookie.utils";
import { ResponseFormatter } from "../../../shared/utils/responseFormatter.utils";
import { IAuthService } from "../contracts/IAuthService.contract";
import { AuthService } from "../services/auth.service";
import type { NextFunction, Request, Response } from "express";

export class AuthController {
   protected authService: IAuthService;
   constructor(authService: IAuthService) {
      if (!authService) {
         throw new ResourceNotInitializedError("AuthService must be provided to AuthController");
      }
      this.authService = authService;
   }

   async onboardSuperAdmin(req: Request, res: Response, next: NextFunction) {
      try {
         const validatedUser = req.body;
         const result = await this.authService.onboardSuperAdmin(validatedUser);
         const token = result.token;
         CookieUtils.setCookie(res, "authToken", token);
         return res.status(201).json(ResponseFormatter.success("Super admin onboarded successfully", 201, { user: result.user }));
      } catch (error) {
         next(error);
      }
   }

   async register(req: Request, res: Response, next: NextFunction) {
      try {
         const validatedUser = req.body;
         const result = await this.authService.register(validatedUser);
         return res.status(201).json(ResponseFormatter.success("User registered successfully", 201, { user: result }));
      } catch (error) {
         next(error);
      }
   }

   async login(req: Request, res: Response, next: NextFunction) {
      try {
         const validatedUser = req.body;
         const result = await this.authService.login(validatedUser);
         const token = result.token;
         CookieUtils.setCookie(res, "authToken", token);
         return res.status(200).json(ResponseFormatter.success("User logged in successfully", 200, { user: result.user }));
      } catch (error) {
         next(error);
      }
   }

   async profile(req: AuthorizedRequest, res: Response, next: NextFunction) {
      try {
         if (!req.user || !req.user.id) {
            throw new PermissionNotGranted("User information is missing in the request");
         }
         const result = await this.authService.getProfile(req?.user.id);
         return res.status(200).json(ResponseFormatter.success("User profile fetched successfully", 200, { user: result }));
      } catch (error) {
         next(error);
      }
   }

   async logout(req: Request, res: Response, next: NextFunction) {
      try {
         CookieUtils.clearCookie(res, "authToken");
         return res.status(200).json(ResponseFormatter.success("User logged out successfully", 200));
      } catch (error) {
         next(error);
      }
   }

   async changePassword(req: AuthorizedRequest, res: Response, next: NextFunction) {
      try {
         await this.authService.changePassword(req.user!.id, req.body);
         return res.status(200).json(ResponseFormatter.success("Password changed successfully.", 200, null));
      } catch (error) {
         next(error);
      }
   }

   async resendVerificationEmail(req: Request, res: Response, next: NextFunction) {
      try {
         await this.authService.resendVerificationEmail(req.body.email);
         return res
            .status(200)
            .json(ResponseFormatter.success("If that email exists and isn't verified yet, a new link has been sent.", 200, null));
      } catch (error) {
         next(error);
      }
   }

   async verifyEmail(req: Request, res: Response, next: NextFunction) {
      try {
         await this.authService.verifyEmail(req.body.token);
         return res.status(200).json(ResponseFormatter.success("Email verified successfully.", 200, null));
      } catch (error) {
         next(error);
      }
   }

   async forgotPassword(req: Request, res: Response, next: NextFunction) {
      try {
         await this.authService.forgotPassword(req.body.email);
         return res
            .status(200)
            .json(ResponseFormatter.success("If that email exists, a password reset link has been sent.", 200, null));
      } catch (error) {
         next(error);
      }
   }

   async resetPassword(req: Request, res: Response, next: NextFunction) {
      try {
         await this.authService.resetPassword(req.body.token, req.body.newPassword);
         return res.status(200).json(ResponseFormatter.success("Password reset successfully.", 200, null));
      } catch (error) {
         next(error);
      }
   }
}
