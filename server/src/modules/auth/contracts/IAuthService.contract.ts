import { User, UserWithId } from "../../../shared/infra/db/mongo/models/user.model";
import { RegistrationDTOType } from "../dtos/onboarding.dto";
import { ChangePasswordDTOType } from "../dtos/changePassword.dto";
import { UserResponseDto } from "../dtos/userResponse.dto";

export interface IAuthService {
   onboardSuperAdmin(superAdminData: Partial<UserWithId>): Promise<{ user: UserResponseDto; token: string }>;

   register(userData: RegistrationDTOType): Promise<UserResponseDto>;

   login(loginData: { email: string; password: string }): Promise<{ user: UserResponseDto; token: string }>;

   getProfile(userId: string): Promise<Omit<User, "password" | "trash" | "isActive">>;

   isSuperAdmin(id: string): Promise<boolean>;

   changePassword(userId: string, data: ChangePasswordDTOType): Promise<void>;

   resendVerificationEmail(email: string): Promise<void>;

   verifyEmail(token: string): Promise<void>;

   forgotPassword(email: string): Promise<void>;

   resetPassword(token: string, newPassword: string): Promise<void>;
}
