import { z } from "zod";

export const ChangePasswordDTO = z
   .object({
      currentPassword: z.string().min(1, "Current password is required"),
      newPassword: z
         .string()
         .min(8, "Password must be at least 8 characters")
         .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
            "Password must contain uppercase, lowercase, number, and special character",
         ),
      confirmNewPassword: z.string().min(1, "Confirm password is required"),
   })
   .refine((data) => data.newPassword === data.confirmNewPassword, {
      message: "Passwords do not match",
      path: ["confirmNewPassword"],
   });

export type ChangePasswordDTOType = z.infer<typeof ChangePasswordDTO>;
