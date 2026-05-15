import { globalConfig } from "../../../shared/config/global.config";
import { User, UserDocument, UserWithId } from "../../../shared/infra/db/mongo/models/user.model";
import { InvalidInputError, PermissionNotGranted, ResourceNotFoundError, ResourceNotInitializedError } from "../../../shared/typings/error.typings";
import { JwtUtils } from "../../../shared/utils/jwt.utils";
import { UserBaseRepo } from "../repos/userBase.repo";
import logger from "../../../shared/config/logger.config";
import { RegistrationDTOType } from "../dtos/onboarding.dto";
import { ChangePasswordDTOType } from "../dtos/changePassword.dto";
import { PasswordUtils } from "../../../shared/utils/password.utils";
import { USER_ROLE } from "../../../shared/typings/auth.typings";
import { UserResponseDto } from "../dtos/userResponse.dto";

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
   protected userRepo: UserBaseRepo<UserWithId>;
   private jwtUtils: typeof JwtUtils;

   constructor(userRepo: UserBaseRepo<UserWithId>, jwtUtils: typeof JwtUtils = JwtUtils) {
      if (!userRepo) {
         throw new ResourceNotInitializedError("User repository must be provided to AuthService");
      }
      this.userRepo = userRepo;
      this.jwtUtils = jwtUtils;
   }

   private generateToken(user: UserWithId): string {
      const payload = {
         id: user._id.toString(),
         role: user.role,
         permissions: user.permissions ?? DEFAULT_PERMISSIONS,
         clientId: user.clientId ? user.clientId.toString() : undefined,
      };

      return this.jwtUtils.generateToken(payload, globalConfig.jwt.secret, globalConfig.jwt.expiresIn);
   }

   private formatUserResponseWithoutPassword(user: User): Omit<User, "password" | "trash" | "isActive"> {
      const { password, trash, isActive, ...rest } = user;
      return rest;
   }

   private async checkExists(field: "email" | "username", payload: Partial<User>, isSuperAdmin: boolean = false) {
      if (!field) return;

      const exists =
         field === "email"
            ? await this.userRepo.findIfAnyExists(isSuperAdmin, payload.email!)
            : await this.userRepo.findByUsername(payload.username!, true);

      if (exists) {
         const message =
            field === "email"
               ? isSuperAdmin
                  ? "Super admin already exists."
                  : "User with this email already exists."
               : "User with this username already exists.";

         throw new PermissionNotGranted(message);
      }
   }

   private async createUser(
      payload: Partial<User>,
      options?: {
         uniqueBy?: UniqueCheck;
         isSuperAdmin?: boolean;
      },
   ): Promise<UserWithId> {
      const { uniqueBy = "email", isSuperAdmin = false } = options || {};

      if (uniqueBy === "email" || uniqueBy === "both") await this.checkExists("email", payload, isSuperAdmin);
      if (uniqueBy === "username" || uniqueBy === "both") await this.checkExists("username", payload, isSuperAdmin);

      const user = (await this.userRepo.create(payload)) as UserWithId;

      logger.info(`${isSuperAdmin ? "Super admin" : "User"} created: ${user.email}`);

      return user;
   }

   async onboardSuperAdmin(superAdminData: Partial<UserWithId>): Promise<{ user: UserResponseDto; token: string }> {
      try {
         const user = await this.createUser(superAdminData, {
            uniqueBy: "email",
            isSuperAdmin: true,
         });

         const token = this.generateToken(user);

         return {
            user: new UserResponseDto(user),
            token,
         };
      } catch (error) {
         logger.error("Super admin onboarding failed", { error });
         throw error;
      }
   }

   async register(userData: RegistrationDTOType): Promise<UserResponseDto> {
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

         return new UserResponseDto(user);
      } catch (error) {
         logger.error("User registration failed", { error });
         throw error;
      }
   }

   async login(loginData: { email: string; password: string }): Promise<{ user: UserResponseDto; token: string }> {
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

         const token = this.generateToken(user as UserWithId);

         logger.info(`User logged in: ${user.email}`);

         return {
            user: new UserResponseDto(user as UserWithId),
            token,
         };
      } catch (error) {
         logger.error("Login failed", { error });
         throw error;
      }
   }

   async getProfile(userId: string): Promise<Omit<User, "password" | "trash" | "isActive">> {
      const user = await this.userRepo.findById(userId);
      if (!user) {
         logger.warn(`User not found for profile: ${userId}`);
         throw new PermissionNotGranted("User not found.");
      }
      return this.formatUserResponseWithoutPassword(user);
   }

   async isSuperAdmin(id: string): Promise<boolean> {
      const role = await this.userRepo.findUserRole(id);
      return role === USER_ROLE.SUPER_ADMIN;
   }

   async changePassword(userId: string, data: ChangePasswordDTOType): Promise<void> {
      try {
         // findById strips the password field, so we fetch by email after getting the email
         const userMeta = await this.userRepo.findById(userId);
         if (!userMeta) throw new ResourceNotFoundError("User not found.");

         // fetch with password included via findByEmail
         const userWithPassword = await this.userRepo.findByEmail(userMeta.email);
         if (!userWithPassword) throw new ResourceNotFoundError("User not found.");

         const isValid = await PasswordUtils.comparePassword(data.currentPassword, userWithPassword.password);
         if (!isValid) throw new InvalidInputError("Current password is incorrect.");

         const hashed = await PasswordUtils.hashPassword(data.newPassword);
         await this.userRepo.update(userId, { password: hashed });
         logger.info(`[AuthService] Password changed for user: ${userId}`);
      } catch (error) {
         logger.error("[AuthService] Error changing password", { error, userId });
         throw error;
      }
   }
}
