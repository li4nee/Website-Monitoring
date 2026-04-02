import { globalConfig } from "../../../shared/config/global.config";
import { User, UserDocument } from "../../../shared/models/user.model";
import { PermissionNotGranted, ResourceNotInitializedError } from "../../../shared/typings/error.typings";
import { JwtUtils } from "../../../shared/utils/jwt.utils";
import { UserBaseRepo } from "../repos/base.repo";
import logger from "../../../shared/config/logger.config";
import { RegistrationDTOType } from "../dtos/onboarding.dto";
import { PasswordUtils } from "../../../shared/utils/password.utils";
import { USER_ROLE } from "../../../shared/typings/base.typings";

type UniqueCheck = "email" | "username" | "both";

const DEFAULT_PERMISSIONS = {
   canCreateApiKeys: false,
   canManageUsers: false,
   canViewRawLogs: false,
   canViewAnalytics: false,
   canManageSettings: false,
   canExportData: false,
};

export class AuthService {
   protected userRepo: UserBaseRepo<User>;
   private jwtUtils = JwtUtils;

   constructor(userRepo: UserBaseRepo<User>) {
      if (!userRepo) {
         throw new ResourceNotInitializedError("User repository must be provided to AuthService");
      }
      this.userRepo = userRepo;
   }

   private generateToken(user: UserDocument): string {
      const payload = {
         id: user._id.toString(),
         role: user.role,
         permissions: user.permissions ?? DEFAULT_PERMISSIONS,
      };

      return this.jwtUtils.generateToken(payload, globalConfig.jwt.secret, globalConfig.jwt.expiresIn);
   }

   private formatUserResponseWithoutPassword(user: UserDocument): Omit<User, "password"> {
      const userObj = user.toObject ? user.toObject() : { ...user };
      const { password, ...rest } = userObj;
      return rest;
   }

   private async createUser(
      payload: Partial<User>,
      options?: {
         uniqueBy?: UniqueCheck;
         isSuperAdmin?: boolean;
      },
   ): Promise<UserDocument> {
      const { uniqueBy = "email", isSuperAdmin = false } = options || {};

      if (uniqueBy === "email" || uniqueBy === "both") {
         if (payload.email) {
            const emailExists = await this.userRepo.findIfAnyExists(isSuperAdmin, payload.email);

            if (emailExists) {
               throw new PermissionNotGranted(
                  isSuperAdmin ? "Super admin already exists." : "User with this email already exists.",
               );
            }
         }
      }

      if (uniqueBy === "username" || uniqueBy === "both") {
         if (payload.username) {
            const usernameExists = await this.userRepo.findByUsername(payload.username);

            if (usernameExists) {
               throw new PermissionNotGranted("User with this username already exists.");
            }
         }
      }

      const user = (await this.userRepo.create(payload)) as UserDocument;

      logger.info(`${isSuperAdmin ? "Super admin" : "User"} created: ${user.email}`);

      return user;
   }

   async onboardSuperAdmin(superAdminData: Partial<User>): Promise<{ user: Omit<User, "password">; token: string }> {
      try {
         const user = await this.createUser(superAdminData, {
            uniqueBy: "email",
            isSuperAdmin: true,
         });

         const token = this.generateToken(user);

         return {
            user: this.formatUserResponseWithoutPassword(user),
            token,
         };
      } catch (error) {
         logger.error("Super admin onboarding failed", { error });
         throw error;
      }
   }

   async register(userData: RegistrationDTOType): Promise<Omit<User, "password">> {
      try {
         const payload: Partial<User> = {
            email: userData.email,
            username: userData.username,
            password: userData.password,
            role: userData.role || USER_ROLE.CLIENT_USER,
         };

         const user = await this.createUser(payload, {
            uniqueBy: "both",
         });

         return this.formatUserResponseWithoutPassword(user);
      } catch (error) {
         logger.error("User registration failed", { error });
         throw error;
      }
   }

   async login(loginData: { email: string; password: string }): Promise<{ user: Omit<User, "password">; token: string }> {
      try {
         const user = await this.userRepo.findByEmail(loginData.email);

         if (!user) {
            logger.warn(`Invalid login attempt: ${loginData.email}`);
            throw new PermissionNotGranted("Invalid email or password.");
         }

         if (!user.isActive) {
            logger.warn(`Inactive user login attempt: ${loginData.email}`);
            throw new PermissionNotGranted("User account is inactive. Please contact administrator.");
         }

         const isPasswordValid = await PasswordUtils.comparePassword(loginData.password, user.password);

         if (!isPasswordValid) {
            logger.warn(`Invalid password for: ${loginData.email}`);
            throw new PermissionNotGranted("Invalid email or password.");
         }

         const token = this.generateToken(user as UserDocument);

         logger.info(`User logged in: ${user.email}`);

         return {
            user: this.formatUserResponseWithoutPassword(user as UserDocument),
            token,
         };
      } catch (error) {
         logger.error("Login failed", { error });
         throw error;
      }
   }

   async getProfile(userId:string): Promise<Omit<User, "password">> 
   {
      const user = await this.userRepo.findById(userId) as UserDocument;
      if (!user) {
         logger.warn(`User not found for profile: ${userId}`);
         throw new PermissionNotGranted("User not found.");
      }
      return this.formatUserResponseWithoutPassword(user);
   }
}
