import crypto from "crypto";
import { globalConfig } from "../../../shared/config/global.config";
import { User, UserDocument, UserWithId } from "../../../shared/infra/db/mongo/models/user.model";
import {
   EmailNotVerifiedError,
   InvalidInputError,
   PermissionNotGranted,
   ResourceNotFoundError,
   ResourceNotInitializedError,
} from "../../../shared/typings/error.typings";
import { JwtUtils } from "../../../shared/utils/jwt.utils";
import { UserBaseRepo } from "../repos/userBase.repo";
import logger from "../../../shared/config/logger.config";
import { RegistrationDTOType } from "../dtos/onboarding.dto";
import { ChangePasswordDTOType } from "../dtos/changePassword.dto";
import { PasswordUtils } from "../../../shared/utils/password.utils";
import { IPasswordUtils, JwtConfig, USER_ROLE } from "../../../shared/typings/auth.typings";
import { UserResponseDto } from "../dtos/userResponse.dto";
import { issueAndSendVerificationEmail, hashVerificationOrResetToken } from "../../../shared/utils/emailVerification.utils";
import { sendViaResend } from "../../../shared/utils/resendMailer.utils";
import { buildPasswordResetEmailHtml } from "../../../shared/utils/authEmailTemplates.utils";
import { AuthTokenCache, EMAIL_VERIFICATION_TOKEN_PREFIX, PASSWORD_RESET_TOKEN_PREFIX } from "../../../shared/infra/cache/authTokenCache";

const PASSWORD_RESET_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour

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
   private jwtConfig: JwtConfig;
   private passwordUtils: IPasswordUtils;

   constructor(
      userRepo: UserBaseRepo<UserWithId>,
      jwtUtils: typeof JwtUtils = JwtUtils,
      jwtConfig: JwtConfig = { secret: globalConfig.jwt.secret, expiresIn: globalConfig.jwt.expiresIn },
      passwordUtils: IPasswordUtils = PasswordUtils,
   ) {
      if (!userRepo) {
         throw new ResourceNotInitializedError("User repository must be provided to AuthService");
      }
      this.userRepo = userRepo;
      this.jwtUtils = jwtUtils;
      this.jwtConfig = jwtConfig;
      this.passwordUtils = passwordUtils;
   }

   private generateToken(user: UserWithId): string {
      const payload = {
         id: user._id.toString(),
         role: user.role,
         permissions: user.permissions ?? DEFAULT_PERMISSIONS,
         clientId: user.clientId ? user.clientId.toString() : undefined,
      };

      return this.jwtUtils.generateToken(payload, this.jwtConfig.secret, this.jwtConfig.expiresIn);
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

         throw new InvalidInputError(message);
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
         const user = await this.createUser(
            { ...superAdminData, isEmailVerified: true },
            {
               uniqueBy: "email",
               isSuperAdmin: true,
            },
         );

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

         void issueAndSendVerificationEmail(user);

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

         const isPasswordValid = await this.passwordUtils.comparePassword(loginData.password, user.password);

         if (!isPasswordValid) {
            logger.warn(`Invalid password for: ${loginData.email}`);
            throw new PermissionNotGranted("Invalid email or password.");
         }

         if (!user.isEmailVerified) {
            logger.warn(`Unverified login attempt: ${loginData.email}`);
            throw new EmailNotVerifiedError();
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
         throw new ResourceNotFoundError("User not found.");
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

   async resendVerificationEmail(email: string): Promise<void> {
      const user = await this.userRepo.findByEmail(email, true);
      if (!user) return;

      const full = await this.userRepo.findById(user._id.toString());
      if (!full || full.isEmailVerified) return;

      await issueAndSendVerificationEmail(full);
   }

   async verifyEmail(token: string): Promise<void> {
      const tokenHash = hashVerificationOrResetToken(token);
      const userId = await AuthTokenCache.consume(EMAIL_VERIFICATION_TOKEN_PREFIX, tokenHash);

      if (!userId) {
         throw new InvalidInputError("This verification link is invalid or has expired.");
      }

      await this.userRepo.update(userId, { isEmailVerified: true });

      logger.info(`[AuthService] Email verified for user: ${userId}`);
   }

   /**
    * Always resolves without revealing whether the email exists, to avoid account enumeration.
    */
   async forgotPassword(email: string): Promise<void> {
      const user = await this.userRepo.findByEmail(email, true);
      if (!user) return;

      try {
         const rawToken = crypto.randomBytes(32).toString("hex");
         const tokenHash = hashVerificationOrResetToken(rawToken);

         await AuthTokenCache.store(PASSWORD_RESET_TOKEN_PREFIX, tokenHash, user._id.toString(), PASSWORD_RESET_TOKEN_TTL_SECONDS);

         if (!globalConfig.email.resendApiKey) {
            logger.warn("[AuthService] RESEND_API_KEY is not configured. Skipping password reset email.");
            return;
         }

         const full = await this.userRepo.findById(user._id.toString());
         if (!full) return;

         const resetUrl = `${globalConfig.frontendUrl}/reset-password?token=${rawToken}`;

         await sendViaResend({
            apiKey: globalConfig.email.resendApiKey,
            from: globalConfig.email.defaultFrom,
            to: full.email,
            subject: "Reset your ServerStats password",
            html: buildPasswordResetEmailHtml(resetUrl),
         });

         logger.info(`[AuthService] Password reset email sent to ${full.email}`);
      } catch (error) {
         logger.error("[AuthService] Failed to send password reset email", { error, userId: user._id.toString() });
      }
   }

   async resetPassword(token: string, newPassword: string): Promise<void> {
      const tokenHash = hashVerificationOrResetToken(token);
      const userId = await AuthTokenCache.consume(PASSWORD_RESET_TOKEN_PREFIX, tokenHash);

      if (!userId) {
         throw new InvalidInputError("This password reset link is invalid or has expired.");
      }

      const hashed = await PasswordUtils.hashPassword(newPassword);
      await this.userRepo.update(userId, { password: hashed });

      logger.info(`[AuthService] Password reset for user: ${userId}`);
   }
}
