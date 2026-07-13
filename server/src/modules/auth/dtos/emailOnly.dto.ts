import { z } from "zod";

export const EmailOnlyDTO = z.object({
   email: z.string().email("Please enter a valid email address"),
});

export type EmailOnlyDTOType = z.infer<typeof EmailOnlyDTO>;
