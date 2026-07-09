import { z } from "zod";

export const UpdateClientDTO = z
   .object({
      name: z.string().min(2).max(100).optional(),
      email: z.string().email().optional(),
      description: z.string().max(500).optional(),
      website: z.string().url().optional(),
      settings: z
         .object({
            dataRetentionPeriod: z.number().int().min(2).max(365).optional(),
            timezone: z.string().optional(),
         })
         .optional(),
   })
   .refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided for update." });

export type UpdateClientDTOType = z.infer<typeof UpdateClientDTO>;
