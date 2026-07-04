import { z } from "zod";

export const ListAuditLogsQueryDTO = z.object({
   clientId: z.string().min(1, "clientId is required"),
   limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 20))
      .refine((val) => val >= 1 && val <= 100, { message: "limit must be between 1 and 100" }),
   cursor: z.string().optional(),
});

export type ListAuditLogsQueryDTOType = z.infer<typeof ListAuditLogsQueryDTO>;
