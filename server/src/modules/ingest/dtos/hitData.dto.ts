import { z } from "zod";

export const HitDataDto = z.object({
   serviceName: z.string().min(1, "Service name is required"),
   endpoint: z.string().min(1, "Endpoint is required"),
   method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"]),
   statusCode: z
      .number()
      .int()
      .min(100, "Status code must be between 100 and 599")
      .max(599, "Status code must be between 100 and 599"),
   latencyMs: z.number().min(0, "Latency must be a non-negative number"),
});

export type ApiHitDataDtoType = z.infer<typeof HitDataDto>;
