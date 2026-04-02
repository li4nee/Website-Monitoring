import { User } from "../../../shared/models/user.model";
import { AuthorizedRequest } from "../../../shared/typings/base.typings";
import { PermissionNotGranted, ResourceNotInitializedError } from "../../../shared/typings/error.typings";
import { CookieUtils } from "../../../shared/utils/cookie.utils";
import { ResponseFormatter } from "../../../shared/utils/responseFormatter.utils";
import { SuperAdminOnboardingDto } from "../dtos/onboarding.dto";
import { AuthService } from "../services/auth.service";
import type { NextFunction, Request, Response } from "express";

export class AuthController {
   protected authService: AuthService;
   constructor(authService: AuthService) {
      if (!authService) {
         throw new ResourceNotInitializedError("AuthService must be provided to AuthController");
      }
      this.authService = authService;
   }

   async onboardSuperAdmin(req: Request, res: Response, next: NextFunction) {
      try {
         const validatedUser = req.body
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
         const validatedUser = req.body
         const result = await this.authService.register(validatedUser);
         return res.status(201).json(ResponseFormatter.success("User registered successfully", 201, { user: result }));
      } catch (error) {
         next(error);
      }
   }

   async login(req: Request, res: Response, next: NextFunction) {
      try {
         const validatedUser = req.body
         const result = await this.authService.login(validatedUser);
         const token = result.token;
         CookieUtils.setCookie(res, "authToken", token);
         return res.status(200).json(ResponseFormatter.success("User logged in successfully", 200, { user: result.user }));
      } catch (error) {
         next(error);
      }
   }

   async profile ( req:AuthorizedRequest,res: Response, next: NextFunction)
   {
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
}

