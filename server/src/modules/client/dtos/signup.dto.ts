import { z } from "zod";

export const SignupDTO = z
   .object({
      companyName: z.string().min(3, "Company name must be at least 3 characters"),
      companyWebsite: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
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
      path: ["confirmPassword"],
   });

export type SignupDTOType = z.infer<typeof SignupDTO>;
