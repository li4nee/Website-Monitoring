import { z } from "zod";

export const ListAlertsQueryDTO = z.object({
   clientId: z.string().min(1, "clientId is required"),
   limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 20))
      .refine((val) => val >= 1 && val <= 100, { message: "limit must be between 1 and 100" }),
   cursor: z.string().optional(),
});

export type ListAlertsQueryDTOType = z.infer<typeof ListAlertsQueryDTO>;

export const AlertHistoryQueryDTO = z.object({
   limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 20))
      .refine((val) => val >= 1 && val <= 100, { message: "limit must be between 1 and 100" }),
   cursor: z.string().optional(),
});

export type AlertHistoryQueryDTOType = z.infer<typeof AlertHistoryQueryDTO>;

export const AlertIdParamSchema = z.object({
   id: z.string().min(1, "Alert ID is required"),
});

export const AlertClientParamSchema = z.object({
   clientId: z.string().min(1, "clientId is required"),
   id: z.string().min(1, "Alert ID is required"),
});
