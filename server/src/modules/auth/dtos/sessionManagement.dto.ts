import {z} from "zod";

export const LoginDTO = z.object({
   email: z.string().email("Please enter a valid email address"),
   password: z.string().min(8, "Password must be at least 8 characters"),
});
export type LoginDTOType = z.infer<typeof LoginDTO>;
