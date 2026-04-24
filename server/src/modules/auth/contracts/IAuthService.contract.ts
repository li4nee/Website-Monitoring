import { User, UserWithId } from "../../../shared/models/user.model";
import { RegistrationDTOType } from "../dtos/onboarding.dto";
import { UserResponseDto } from "../dtos/userResponse.dto";

export interface IAuthService {
   onboardSuperAdmin(superAdminData: Partial<UserWithId>): Promise<{ user: UserResponseDto; token: string }>;

   register(userData: RegistrationDTOType): Promise<UserResponseDto>;

   login(loginData: { email: string; password: string }): Promise<{ user: UserResponseDto; token: string }>;

   getProfile(userId: string): Promise<Omit<User, "password" | "trash" | "isActive">>;

   isSuperAdmin(id: string): Promise<boolean>;
}
