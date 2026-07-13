import { z } from "zod";

export const VerifyEmailDTO = z.object({
   token: z.string().min(1, "Token is required"),
});

export type VerifyEmailDTOType = z.infer<typeof VerifyEmailDTO>;
