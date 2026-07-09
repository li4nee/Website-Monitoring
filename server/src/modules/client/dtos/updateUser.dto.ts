import { z } from "zod";

export const UpdateUserPermissionsDTO = z
   .object({
      canCreateApiKeys: z.boolean().optional(),
      canManageUsers: z.boolean().optional(),
      canViewRawLogs: z.boolean().optional(),
      canViewAnalytics: z.boolean().optional(),
      canManageSettings: z.boolean().optional(),
      canExportData: z.boolean().optional(),
   })
   .refine((data) => Object.keys(data).length > 0, { message: "At least one permission must be specified." });

export type UpdateUserPermissionsDTOType = z.infer<typeof UpdateUserPermissionsDTO>;

export const userIdParamSchema = z.object({
   clientId: z.string().min(1, "clientId is required"),
   userId: z.string().min(1, "userId is required"),
});

export type UserIdParamType = z.infer<typeof userIdParamSchema>;
