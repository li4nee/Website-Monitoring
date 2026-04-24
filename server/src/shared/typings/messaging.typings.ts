export enum EventType {
   API_HITS = "API_HITS",
}

export interface EventProducerMetricsType {
   published: number;
   failed: number;
   retriesUsed: number;
}

// messageId = unique ID of one single text message
// correlationId = chat ID of the whole conversation
export interface PublishingEventDataType {
   eventData: EventDataType;
   messageId: string;
   correlationId: string;
   attempts?: number;
}

export interface EventDataType {
   eventId: string;
   timeStamp: string;
   serviceName: string;
   endpoint: string;
   method: string;
   statusCode: number;
   latencyMs: number;
   clientId: string;
   apiKeyId: string;
   ip?: string;
   userAgent?: string;
}
export interface PublishingMessageType {
   type: EventType;
   data: PublishingEventDataType;
   publishedAt: String;
}

export interface PublishOptions {
   persistent: boolean; // Whether the message should be marked as persistent
   contentType: string; // Content type of the message
   messageId: string; // Unique identifier for the message
   correlationId: string; // Correlation ID for tracking related messages
   timestamp: number; // Timestamp of when the message was published , but in seconds not in ms
}
