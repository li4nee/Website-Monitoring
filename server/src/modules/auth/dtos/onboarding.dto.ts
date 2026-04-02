import { z } from "zod";
import { USER_ROLE } from "../../../shared/typings/base.typings";

export const OnboardingBaseDto = z
   .object({
      username: z
         .string()
         .min(3, "Username must be at least 3 characters")
         .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),

      email: z.string().email("Please enter a valid email address"),

      password: z
         .string()
         .min(8, "Password must be at least 8 characters")
         .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
            "Password must contain uppercase, lowercase, number, and special character",
         ),

      confirmPassword: z.string().min(8, "Confirm password must be at least 8 characters"),
   })
   .refine((data) => data.password === data.confirmPassword, {
      message: "Passwords do not match",
   });

export const SuperAdminOnboardingDto = OnboardingBaseDto.extend({
   role: z.literal(USER_ROLE.SUPER_ADMIN),
});
export type SuperAdminOnboardingDtoType = z.infer<typeof SuperAdminOnboardingDto>;

export const RegistrationDTO = OnboardingBaseDto.extend({
   role: z.enum(USER_ROLE)
});
export type RegistrationDTOType = z.infer<typeof RegistrationDTO>;