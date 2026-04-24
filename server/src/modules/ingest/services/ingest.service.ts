import { IEventProducer } from "../../../shared/contracts/infra/IEventProducer.contract";
import { EventProducer } from "../../../shared/infra/eventProducer";
import { EventDataType } from "../../../shared/typings/messaging.typings";
import { ApiHitDataDtoType } from "../dtos/hitData.dto";
import { v4 as uuidv4 } from "uuid";
import { IngestApiHitResponseDto } from "../dtos/ingestApiHitResponse.dto";
import logger from "../../../shared/config/logger.config";
export class IngestService {
   private eventProducer: IEventProducer;
   constructor(eventProducer: IEventProducer) {
      this.eventProducer = eventProducer;
   }

   async ingestApiHit(
      data: ApiHitDataDtoType,
      clientId: string,
      apiKeyId: string,
      ip?: string,
      userAgent?: string,
   ): Promise<IngestApiHitResponseDto> {
      try {
         const eventData: EventDataType = {
            eventId: uuidv4(),
            timeStamp: new Date().toISOString(),
            serviceName: data.serviceName,
            endpoint: data.endpoint,
            method: data.method,
            statusCode: data.statusCode,
            latencyMs: data.latencyMs,
            clientId: clientId,
            apiKeyId: apiKeyId,
            ip: ip || "unknown",
            userAgent: userAgent || "unknown",
         };

         let publishOptions = {
            persistent: true,
            contentType: "application/json",
            messageId: eventData.eventId,
            correlationId: eventData.clientId,
            timestamp: Math.floor(Date.now() / 1000), // RabbitMQ expects timestamp in seconds
         };

         let publishData = {
            eventData,
            messageId: publishOptions.messageId,
            correlationId: publishOptions.correlationId,
            attempts: 0,
         };

         await this.eventProducer.publishApiHits(publishData, publishOptions);
         return {
            eventId: eventData.eventId,
            status: "success",
            timeStamp: eventData.timeStamp,
         };
      } catch (error) {
         logger.error("Failed to publish API hit event", { error, data });
         throw error;
      }
   }
}
