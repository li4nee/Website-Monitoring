import { z } from 'zod';
import { HTTP_METHODS } from '../../../shared/typings/auth.typings';

export const EventDataDto = z.object({
	eventId: z.string(),
	timeStamp: z.string(),
	serviceName: z.string(),
	endpoint: z.string(),
	method: z.enum(HTTP_METHODS),
	statusCode: z.number(),
	latencyMs: z.number(),
	clientId: z.string(),
	apiKeyId: z.string(),
	ipInIpV4: z.string().optional(),
	ipInIpV6: z.string().optional(),
	userAgent: z.string().optional(),
});

export type EventDataDto = z.infer<typeof EventDataDto>;
