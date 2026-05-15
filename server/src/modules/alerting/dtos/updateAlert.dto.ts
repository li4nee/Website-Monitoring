import { z } from "zod";

const ChannelConfigSchema = z.object({
   type: z.enum(["email", "webhook", "slack", "discord", "sms"] as const),
   config: z.record(z.string(), z.unknown()),
});

export const UpdateAlertDTO = z.object({
   name: z.string().min(1).max(100).optional(),
   description: z.string().max(500).optional(),
   alertType: z.enum(["threshold", "daily_summary", "weekly_summary", "custom"] as const).optional(),
   channels: z.array(ChannelConfigSchema).min(1).optional(),
   conditions: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateAlertDTOType = z.infer<typeof UpdateAlertDTO>;
