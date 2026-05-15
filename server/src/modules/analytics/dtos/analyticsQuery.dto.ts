import { z } from "zod";

export const AnalyticsTimeRangeQueryDTO = z.object({
   clientId: z.string().min(1, "clientId is required"),
   startTime: z
      .string()
      .optional()
      .transform((val) => (val ? new Date(val) : undefined))
      .refine((val) => val === undefined || !isNaN(val!.getTime()), { message: "startTime must be a valid ISO date string" }),
   endTime: z
      .string()
      .optional()
      .transform((val) => (val ? new Date(val) : undefined))
      .refine((val) => val === undefined || !isNaN(val!.getTime()), { message: "endTime must be a valid ISO date string" }),
   limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .refine((val) => val >= 1 && val <= 100, { message: "limit must be between 1 and 100" }),
});

export type AnalyticsTimeRangeQueryDTOType = z.infer<typeof AnalyticsTimeRangeQueryDTO>;

export const AnalyticsTimeSeriesQueryDTO = z.object({
   clientId: z.string().min(1, "clientId is required"),
   serviceName: z.string().optional(),
   startTime: z
      .string()
      .optional()
      .transform((val) => (val ? new Date(val) : undefined))
      .refine((val) => val === undefined || !isNaN(val!.getTime()), { message: "startTime must be a valid ISO date string" }),
   endTime: z
      .string()
      .optional()
      .transform((val) => (val ? new Date(val) : undefined))
      .refine((val) => val === undefined || !isNaN(val!.getTime()), { message: "endTime must be a valid ISO date string" }),
});

export type AnalyticsTimeSeriesQueryDTOType = z.infer<typeof AnalyticsTimeSeriesQueryDTO>;

export const RawLogsQueryDTO = z.object({
   clientId: z.string().min(1, "clientId is required"),
   serviceName: z.string().optional(),
   endpoint: z.string().optional(),
   method: z.string().optional(),
   statusCode: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : undefined))
      .refine((val) => val === undefined || !isNaN(val), { message: "statusCode must be a number" }),
   startTime: z
      .string()
      .optional()
      .transform((val) => (val ? new Date(val) : undefined))
      .refine((val) => val === undefined || !isNaN(val!.getTime()), { message: "startTime must be a valid ISO date string" }),
   endTime: z
      .string()
      .optional()
      .transform((val) => (val ? new Date(val) : undefined))
      .refine((val) => val === undefined || !isNaN(val!.getTime()), { message: "endTime must be a valid ISO date string" }),
   limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 50))
      .refine((val) => val >= 1 && val <= 200, { message: "limit must be between 1 and 200" }),
   cursor: z.string().optional(),
});

export type RawLogsQueryDTOType = z.infer<typeof RawLogsQueryDTO>;

export const ServicesQueryDTO = z.object({
   clientId: z.string().min(1, "clientId is required"),
});

export type ServicesQueryDTOType = z.infer<typeof ServicesQueryDTO>;

export const ExportQueryDTO = z.object({
   clientId: z.string().min(1, "clientId is required"),
   serviceName: z.string().optional(),
   endpoint: z.string().optional(),
   method: z.string().optional(),
   statusCode: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : undefined))
      .refine((val) => val === undefined || !isNaN(val), { message: "statusCode must be a number" }),
   startTime: z
      .string()
      .optional()
      .transform((val) => (val ? new Date(val) : undefined))
      .refine((val) => val === undefined || !isNaN(val!.getTime()), { message: "startTime must be a valid ISO date string" }),
   endTime: z
      .string()
      .optional()
      .transform((val) => (val ? new Date(val) : undefined))
      .refine((val) => val === undefined || !isNaN(val!.getTime()), { message: "endTime must be a valid ISO date string" }),
});

export type ExportQueryDTOType = z.infer<typeof ExportQueryDTO>;

export const EndpointDrilldownQueryDTO = z.object({
   clientId: z.string().min(1, "clientId is required"),
   serviceName: z.string().min(1, "serviceName is required"),
   endpoint: z.string().min(1, "endpoint is required"),
   method: z.string().min(1, "method is required"),
   startTime: z
      .string()
      .optional()
      .transform((val) => (val ? new Date(val) : undefined))
      .refine((val) => val === undefined || !isNaN(val!.getTime()), { message: "startTime must be a valid ISO date string" }),
   endTime: z
      .string()
      .optional()
      .transform((val) => (val ? new Date(val) : undefined))
      .refine((val) => val === undefined || !isNaN(val!.getTime()), { message: "endTime must be a valid ISO date string" }),
});

export type EndpointDrilldownQueryDTOType = z.infer<typeof EndpointDrilldownQueryDTO>;
