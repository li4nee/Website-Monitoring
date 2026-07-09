import { globalConfig } from "../../shared/config/global.config";
import logger from "../../shared/config/logger.config";
import { IConfirmChannelManager } from "../../shared/contracts/infra/messaging/IConfirmManager.contract";
import { ICircuitBreaker } from "../../shared/contracts/infra/resilience/ICircuitBreaker.contract";
import { IRetryStrategy } from "../../shared/contracts/infra/resilience/IRetryStrategy.contract";
import { IIdempotencyStore } from "../../shared/contracts/infra/IIdempotencyStore.contract";
import { MongoConnection } from "../../shared/infra/db/mongo/mongoConnection";
import { PostgresConnection } from "../../shared/infra/db/postgres/postgresConnection";
import { RedisConnection } from "../../shared/infra/redisConnection";
import { InvalidInputError, ResourceNotInitializedError } from "../../shared/typings/error.typings";
import { eventConsumerStats } from "../../shared/typings/eventConsumer.typings";
import { IProcessorService } from "./contracts/IProcessorService.contracts";
import amqp from "amqplib";
import { ParsedMessageType, PublishingEventDataTypeSchema } from "./dto/eventMesage.dto";
import { EventType } from "../../shared/typings/messaging.typings";
import { isRetryableError } from "../../shared/utils/infra.utils";
import { MessagePublishError } from "../../shared/typings/eventError.typings";

/**
 * TODO: RN when stopping we can lost some message which are being processed , fix it.
 */

export class EventConsumer {
   private processorService: IProcessorService;
   private amqpConnection: IConfirmChannelManager;
   private retryStrategy: IRetryStrategy;
   private circuitBreaker: ICircuitBreaker;
   private mongoDBConnection: MongoConnection;
   private postgresConnection: PostgresConnection;
   private redisConnection: RedisConnection;
   private idempotencyStore: IIdempotencyStore;

   private mongoPostgresMaxConnectionRetryAttempts = globalConfig.consumer.mongoPostgresConnectionMaxRetryAttemptsInConsumer;

   private prefetchCount = globalConfig.consumer.prefetchCount;
   private isRunning = false;
   private channel: amqp.Channel | null = null;
   private activeMessages = 0;

   private stats: eventConsumerStats = {
      processed: 0,
      failed: 0,
      retried: 0,
      dlqRouted: 0,
      lastProcessedEvent: null,
   };

   // We need this to track what if the specific event type what is causing the failure.
   private failedEventTypesAndCount: Map<string, number> = new Map();

   constructor({
      processorService,
      amqpConnection,
      retryStrategy,
      circuitBreaker,
      mongoDBConnection,
      postgresConnection,
      redisConnection,
      idempotencyStore,
   }: {
      processorService: IProcessorService;
      amqpConnection: IConfirmChannelManager;
      retryStrategy: IRetryStrategy;
      circuitBreaker: ICircuitBreaker;
      mongoDBConnection: MongoConnection;
      postgresConnection: PostgresConnection;
      redisConnection: RedisConnection;
      idempotencyStore: IIdempotencyStore;
   }) {
      this.processorService = processorService;
      this.amqpConnection = amqpConnection;
      this.retryStrategy = retryStrategy;
      this.circuitBreaker = circuitBreaker;
      this.mongoDBConnection = mongoDBConnection;
      this.postgresConnection = postgresConnection;
      this.redisConnection = redisConnection;
      this.idempotencyStore = idempotencyStore;
   }

   private async connectToDatabase(): Promise<void> {
      let attempt = 0;

      while (attempt < this.mongoPostgresMaxConnectionRetryAttempts) {
         try {
            await Promise.all([
               this.mongoDBConnection.connect(),
               this.postgresConnection.testConnection(),
               this.redisConnection.connect(),
            ]);
            logger.info("[Event Consumer] Connected to DBs", { attempt: attempt + 1 });
            return;
         } catch (error) {
            attempt++;

            logger.error("[Event Consumer] DB connection failed", {
               attempt,
               error: (error as Error).message,
            });

            if (attempt >= this.mongoPostgresMaxConnectionRetryAttempts) {
               throw new ResourceNotInitializedError("DB connection failed after max retries");
            }

            const delay = Math.min(1000 * 2 ** attempt, 5000);
            await new Promise((res) => setTimeout(res, delay));
         }
      }
   }

   private async connectToMessageBroker(): Promise<void> {
      this.channel = await this.amqpConnection.getChannel();

      if (!this.channel) {
         throw new ResourceNotInitializedError("Channel not initialized");
      }

      this.channel.prefetch(this.prefetchCount);

      this.channel.on("error", (err) => {
         logger.error("[Event Consumer] Channel error", { error: err.message });
         this.circuitBreaker.onFailure();
      });

      this.channel.on("close", () => {
         logger.warn("[Event Consumer] Channel closed");
         if (this.isRunning) {
            this.reconnectToChannel();
         }
      });
   }

   private async reconnectToChannel(): Promise<void> {
      logger.info("[Event Consumer] Reconnecting channel");

      let delay = 1000;

      while (this.isRunning) {
         try {
            await this.connectToMessageBroker();
            await this.startConsuming();
            logger.info("[Event Consumer] Reconnected successfully");
            return;
         } catch (err) {
            logger.error("[Event Consumer] Reconnect failed", {
               error: (err as Error).message,
            });

            await new Promise((res) => setTimeout(res, delay));
            delay = Math.min(delay * 2, 10000); // Exponential backoff with max delay of 10 seconds
         }
      }
   }

   private async startConsuming(): Promise<void> {
      if (!this.channel) return;

      await this.channel.consume(
         globalConfig.amqp.queue,
         async (msg) => {
            if (msg) await this.handleMessage(msg);
         },
         {
            noAck: false,
            consumerTag: `event_consumer_${Date.now()}`,
         },
      );
   }

   private async parseMessage(msg: amqp.ConsumeMessage): Promise<ParsedMessageType> {
      const content = JSON.parse(msg.content.toString());
      const result = PublishingEventDataTypeSchema.safeParse(content);
      if (!result.success) {
         const errorMessage = result.error.issues.map((issue) => issue.message).join(", ");
         logger.error(
            `[Event Consumer] Message validation failed for message ${msg.properties.messageId}. Errors: ${errorMessage}`,
         );
         throw new InvalidInputError(`Invalid message format: ${errorMessage}`);
      }
      return {
         ...result.data,
         messageId: msg.properties.messageId || result.data.messageId || `${Date.now()}`,
         retryCount: Number(msg.properties.headers?.["x-retry-count"] ?? 0),
         eventType: result.data.eventType,
      };
   }

   private async processMessage(messageData: ParsedMessageType): Promise<void> {
      switch (messageData.eventType) {
         case EventType.API_HITS:
            await this.processorService.processEvent(messageData.eventData);
            break;
         default:
            logger.warn(
               `[Event Consumer] Unknown event type: ${messageData.eventType}. Acknowledging message without processing.`,
            );
            throw new InvalidInputError(`Unknown event type: ${messageData.eventType}`);
      }
   }

   private async handleMessage(msg: amqp.ConsumeMessage) {
      if (!this.circuitBreaker.isRequestAllowed()) {
         logger.warn("[Event Consumer] Circuit breaker is open. Message processing is paused.");
         if (!this.channel) {
            logger.error("[Event Consumer] Channel not available for nack'ing message when circuit breaker is open");
            return;
         }
         // requeue the message with some delay to prevent tight loop of failures
         await new Promise((res) => setTimeout(res, 1000));
         this.channel.nack(msg, false, true);
         return;
      }

      if (!this.channel) {
         logger.error("[Event Consumer] Channel not available for processing message");
         return;
      }

      this.activeMessages++;
      const startTime = Date.now();
      let messageData = null;

      try {
         messageData = await this.parseMessage(msg);

         // Idempotency check
         if (await this.idempotencyStore.hasProcessed(messageData.messageId)) {
            logger.info(
               `[Event Consumer] Message with ID ${messageData.messageId} has already been processed. Acknowledging without reprocessing.`,
            );
            this.channel.ack(msg);
            return;
         }

         await this.processMessage(messageData);

         this.channel.ack(msg);
         this.circuitBreaker.onSuccess();
         this.stats.processed++;
         await this.idempotencyStore.markProcessed(messageData.messageId);
         this.stats.lastProcessedEvent = messageData.messageId;
         logger.info(`[Event Consumer] Message processed successfully`, {
            messageId: messageData.messageId,
            latency: Date.now() - startTime,
         });

         // Keep track which eventType is causing more failure.
         this.failedEventTypesAndCount.delete(messageData.eventType);
      } catch (error) {
         await this.handleProcessingError(error, msg, messageData);
      } finally {
         this.activeMessages--;
      }
   }

   private async handleProcessingError(error: unknown, msg: amqp.ConsumeMessage, messageData: ParsedMessageType | null) {
      const retryCount = messageData?.retryCount || 0;
      const messageId = messageData?.messageId || msg.properties.messageId || "unknown";
      let reason = error instanceof Error ? error.message : "Unknown error";
      this.circuitBreaker.onFailure();
      this.stats.failed++;

      const eventType = messageData?.eventType;
      if (eventType) {
         const currentFailureCount = this.failedEventTypesAndCount.get(eventType) || 0;
         this.failedEventTypesAndCount.set(eventType, currentFailureCount + 1);

         if (currentFailureCount + 1 >= globalConfig.consumer.failureThresholdForEventTypeInConsumer) {
            logger.error(
               `[Event Consumer] Poison Message Detected.Event type ${eventType} has failed ${currentFailureCount + 1} times which is above the threshold. Message ID: ${messageId}. Error: ${(error as Error).message}`,
            );
         }
      }

      if (!isRetryableError(error as any) || !this.retryStrategy.shouldRetry(retryCount)) {
         logger.error(
            `[Event Consumer] Message processing failed and will not be retried. Message ID: ${messageId}. Error: ${(error as Error).message}`,
         );
         reason = !isRetryableError(error as any) ? "Non-retryable error" : "Max retry attempts reached";
         await this.sendToDLQ(msg, messageData, error as Error, reason);
         return;
      }

      await this.retryMessage(msg, messageData!, retryCount, reason);
   }

   private async sendToDLQ(msg: amqp.ConsumeMessage, messageData: ParsedMessageType | null, error: unknown, reason: string) {
      try {
         const dlqMessageContent = {
            originalMessage: messageData,
            error: (error as Error).message,
            failedAt: new Date().toISOString(),
         };

         if (!this.channel) {
            logger.error(
               `[Event Consumer] Channel not available for sending message to DLQ. Message ID: ${messageData?.messageId || "unknown"}`,
            );
            throw new ResourceNotInitializedError("Channel not initialized for DLQ");
         }

         const published = this.channel?.sendToQueue(
            globalConfig.amqp.queue + "_dl",
            Buffer.from(JSON.stringify(dlqMessageContent)),
            {
               persistent: true,
               headers: {
                  ...msg.properties.headers,
                  "x-dlq-reason": reason,
                  "x-original-event-type": messageData?.eventType || "unknown",
                  "x-original-timestamp": Date.now(),
               },
            },
         );

         if (!published) {
            throw new MessagePublishError(
               `Failed to publish message to DLQ for message ID: ${messageData?.messageId || "unknown"}`,
            );
         }

         this.stats.dlqRouted++;
         this.channel?.ack(msg);
      } catch (error) {
         logger.error(
            `[Event Consumer] Failed to route message to DLQ. Message ID: ${messageData?.messageId || "unknown"}. Error: ${(error as Error).message}`,
         );
         this.channel?.nack(msg, false, false); // don't requeue the message
      }
   }

   private async retryMessage(msg: amqp.ConsumeMessage, messageData: ParsedMessageType, retryCount: number, reason: string) {
      try {
         const delay = this.retryStrategy.getRetryDelay(retryCount);
         const retryHeader = {
            ...msg.properties.headers,
            "x-dlq-reason": reason,
            "x-retry-count": retryCount + 1,
            "x-original-event-type": messageData.eventType,
            "x-original-timestamp": Date.now(),
         };
         setTimeout(() => {
            this.channel?.sendToQueue(globalConfig.amqp.queue, msg.content, {
               persistent: true,
               ...msg.properties,
               headers: retryHeader,
            });
         }, delay);
         this.stats.retried++;
         this.channel?.ack(msg);
      } catch (error) {
         logger.error(
            `[Event Consumer] Failed to retry message. Message ID: ${messageData.messageId}. Error: ${(error as Error).message}`,
         );
         this.sendToDLQ(msg, messageData, error, "Failed to retry message");
      }
   }

   async start() {
      if (this.isRunning) return;

      this.isRunning = true;

      try {
         await this.connectToDatabase();
         await this.connectToMessageBroker();
         await this.startConsuming();
         logger.info("[Event Consumer] Consumer started");
      } catch (error) {
         logger.error("[Event Consumer] Failed to start consumer", {
            error: (error as Error).message,
         });

         await this.stop();
      }
   }

   async stop() {
      this.isRunning = false;

      try {
         // Wait like 30 seconds for processing of mid processing message before shutting down.
         const drainDeadline = Date.now() + 30_000;
         while (this.activeMessages > 0 && Date.now() < drainDeadline) {
            logger.info(`[Event Consumer] Draining ${this.activeMessages} active message`);
            await new Promise((res) => setTimeout(res, 200));
         }
         if (this.activeMessages > 0) {
            logger.warn(`[Event Consumer] Shutdown timed out with ${this.activeMessages} message still active`);
         }

         await this.channel?.close();
         this.channel = null;
         await this.amqpConnection.close();
         await this.mongoDBConnection.disconnect();
         await this.postgresConnection.disconnect();
         await this.redisConnection.disconnect();
         logger.info("[Event Consumer] Consumer stopped");
      } catch (err) {
         logger.error("[Event Consumer] Error stopping consumer", {
            error: (err as Error).message,
         });
      }
   }

   async getStats() {
      return {
         ...this.stats,
         circuitBreakerState: this.circuitBreaker.getCurrentState(),
         circuitBreakerStats: this.circuitBreaker.getStats(),
         failedEventTypesAndCount: Array.from(this.failedEventTypesAndCount.entries()).map(([eventType, count]) => ({
            eventType,
            count,
         })),
      };
   }
}
