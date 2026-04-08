import { z } from "zod";

export const CreateClientDTO = z.object({
   name: z.string().min(3, "Client name must be at least 3 characters"),
   email: z.string().email("Please enter a valid email address"),
   website: z.string().url("Please enter a valid URL"),
   description: z.string().optional(),
});

export type CreateClientDTOType = z.infer<typeof CreateClientDTO>;
