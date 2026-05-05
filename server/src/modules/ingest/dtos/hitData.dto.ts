import { z } from "zod";
import { HTTP_METHODS } from "../../../shared/typings/auth.typings";

export const HitDataDto = z.object({
   serviceName: z.string().min(1, "Service name is required"),
   endpoint: z.string().min(1, "Endpoint is required"),
   method: z.enum(HTTP_METHODS, "Invalid HTTP method"),
   statusCode: z
      .number()
      .int()
      .min(100, "Status code must be between 100 and 599")
      .max(599, "Status code must be between 100 and 599"),
   latencyMs: z.number().min(0, "Latency must be a non-negative number"),
   // Ip validation using regex for IPv4 format and Ipv6.
   ipInIpv4: z
      .string()
      .refine((val) => /^(\d{1,3}\.){3}\d{1,3}$/.test(val), "Invalid IP address")
      .optional(),
   ipInTpv6: z
      .string()
      .refine((val) => /^([a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$/.test(val), "Invalid IP address")
      .optional(),
   userAgent: z.string().optional(),
});

export type ApiHitDataDtoType = z.infer<typeof HitDataDto>;
