import { z } from "zod";

export const ResetPasswordDTO = z
   .object({
      token: z.string().min(1, "Token is required"),
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

export type ResetPasswordDTOType = z.infer<typeof ResetPasswordDTO>;
