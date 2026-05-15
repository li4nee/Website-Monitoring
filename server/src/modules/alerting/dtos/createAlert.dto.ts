import { z } from "zod";

const ChannelConfigSchema = z.object({
   type: z.enum(["email", "webhook", "slack", "discord", "sms"] as const),
   config: z.record(z.string(), z.unknown()),
});

export const CreateAlertDTO = z.object({
   name: z.string().min(1).max(100),
   description: z.string().max(500).optional(),
   alertType: z.enum(["threshold", "daily_summary", "weekly_summary", "custom"] as const),
   channels: z.array(ChannelConfigSchema).min(1, "At least one channel is required"),
   conditions: z.record(z.string(), z.unknown()).optional(),
});

export type CreateAlertDTOType = z.infer<typeof CreateAlertDTO>;
