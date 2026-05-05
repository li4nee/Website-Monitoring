import { z } from 'zod';
import { HTTP_METHODS } from '../../../shared/typings/auth.typings';

export const EventDataTypeSchema = z.object({
  eventId: z.string(),
  timeStamp: z.string(),
  serviceName: z.string(),
  endpoint: z.string(),
  method: z.nativeEnum(HTTP_METHODS),
  statusCode: z.number(),
  latencyMs: z.number(),
  clientId: z.string(),
  apiKeyId: z.string(),
  ipInIpV4: z.string().optional(),
  ipInIpV6: z.string().optional(),
  userAgent: z.string().optional(),
});

export const PublishingEventDataTypeSchema = z.object({
  eventData: EventDataTypeSchema,
  messageId: z.string(),
  correlationId: z.string(),
  timeStamp: z.string(),
  attempts: z.number().optional(),
});


export type EventDataDTOType = z.infer<typeof EventDataTypeSchema>;
export type PublishingEventDataDTOType = z.infer<typeof PublishingEventDataTypeSchema>;
