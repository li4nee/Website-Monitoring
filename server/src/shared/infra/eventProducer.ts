import logger from "../config/logger.config";
import { ResourceNotInitializedError } from "../typings/error.typings";
import { ProducerShuttingDownError } from "../typings/eventError.typings";
import {
   EventProducerMetricsType,
   EventType,
   PublishingEventDataType,
   PublishingMessageType,
   PublishOptions,
} from "../typings/messaging.typings";
import { CircuitBreakerStatsType } from "../typings/circuitBreaker.typings";
import { IConfirmChannelManager } from "../contracts/infra/IConfirmManager.contract";
import { ICircuitBreaker } from "../contracts/infra/ICircuitBreaker.contract";
import { IRetryStrategy } from "../contracts/infra/IRetryStrategy.contract";

export class EventProducer {
   private channelManager: IConfirmChannelManager;
   private circuitBreaker: ICircuitBreaker;
   private retryStrategy: IRetryStrategy;
   private queueName: string;
   private isShutingDown: boolean = false;
   private metrics: EventProducerMetricsType = {
      published: 0,
      failed: 0,
      retriesUsed: 0,
   };

   constructor(
      channelManager: IConfirmChannelManager,
      circuitBreaker: ICircuitBreaker,
      retryStrategy: IRetryStrategy,
      queueName: string,
   ) {
      this.channelManager = channelManager;
      this.circuitBreaker = circuitBreaker;
      this.retryStrategy = retryStrategy;
      this.queueName = queueName;
   }

   private incrementMetrics(metrics: Partial<EventProducerMetricsType>): void {
      for (const [key, value] of Object.entries(metrics)) {
         this.metrics[key as keyof EventProducerMetricsType] += value ?? 0;
      }
   }

   private async publish(obj: PublishingEventDataType): Promise<boolean> {
      const message: PublishingMessageType = {
         type: EventType.API_HITS,
         data: obj,
         publishedAt: new Date().toISOString(),
      };

      const publishOptions: PublishOptions = {
         persistent: true,
         contentType: "application/json",
         messageId: obj.messageId,
         correlationId: obj.correlationId,
         timestamp: Math.floor(Date.now() / 1000), // RabbitMQ expects timestamp in seconds
      };

      if (this.isShutingDown) {
         throw new ProducerShuttingDownError("Event producer is shutting down, cannot publish new messages");
      }
      try {
         const currentChannel = await this.channelManager.getChannel();
         const messageBuffer = Buffer.from(JSON.stringify(message));

         return new Promise((resolve, reject) => {
            const written = currentChannel.publish("", this.queueName, messageBuffer, publishOptions, (err) => {
               if (err) {
                  logger.error(`[EventProducer] Failed to publish message to queue ${this.queueName}: ${err.message}`, {
                     error: err,
                     queue: this.queueName,
                     messageId: publishOptions.messageId,
                     correlationId: publishOptions.correlationId,
                  });
                  return reject(err);
               } else {
                  resolve(true);
               }
            });

            // Backpressure handling: if the write buffer is full, wait for the 'drain' event before resolving
            if (!written) {
               logger.warn("[EventProducer] Backpressure detected, waiting for 'drain' event", {
                  queue: this.queueName,
                  messageId: publishOptions.messageId,
                  correlationId: publishOptions.correlationId,
               });
            }
            const onDrain = () => {
               logger.info("[EventProducer] 'drain' event received, resuming message publishing", {
                  queue: this.queueName,
                  messageId: publishOptions.messageId,
                  correlationId: publishOptions.correlationId,
               });
            };
            currentChannel.once("drain", onDrain);
         });
      } catch (error) {
         logger.error(`[EventProducer] Error in publish method for queue ${this.queueName}`, {
            error,
            queue: this.queueName,
            messageId: obj.messageId,
            correlationId: obj.correlationId,
         });
         throw error;
      }
   }

   async shutDown(): Promise<void> {
      try {
         this.isShutingDown = true;
         logger.info("[EventProducer] Shutdown initiated, no new messages will be published", {
            queue: this.queueName,
         });
         await this.channelManager.close();
         logger.info("[EventProducer] Channel manager closed, shutdown complete", {
            queue: this.queueName,
         });
      } catch (error) {
         logger.error("[EventProducer] Shutdown failed", {
            queue: this.queueName,
            error,
         });
         throw error;
      }
   }

   getMetrics(): { metrics: EventProducerMetricsType; circuitBreakerStats: CircuitBreakerStatsType } {
      return {
         metrics: { ...this.metrics },
         circuitBreakerStats: this.circuitBreaker.getStats(),
      };
   }

   async publishApiHits(eventData: PublishingEventDataType, publishOptions: PublishOptions): Promise<boolean> {
      if (this.isShutingDown) {
         logger.warn("[EventProducer] Publish attempt during shutdown", {
            queue: this.queueName,
            messageId: eventData.messageId,
            correlationId: eventData.correlationId,
         });
         throw new ProducerShuttingDownError("Event producer is shutting down, cannot publish new messages");
      }

      if (!this.circuitBreaker.isRequestAllowed()) {
         logger.warn("[EventProducer] Circuit breaker is rejecting publish request", {
            queue: this.queueName,
            messageId: eventData.messageId,
            correlationId: eventData.correlationId,
            state: this.circuitBreaker.getCurrentState(),
         });
         throw new ResourceNotInitializedError("Circuit breaker is rejecting publish request");
      }

      const correlationId = publishOptions.correlationId;
      const startMs = Date.now();
      let attempt = 0;

      while (true) {
         try {
            await this.publish(eventData);
            const latencyMs = Date.now() - startMs;
            this.circuitBreaker.onSuccess();
            this.incrementMetrics({ published: 1, retriesUsed: attempt });

            logger.info("[EventProducer] Message published successfully", {
               queue: this.queueName,
               messageId: eventData.messageId,
               correlationId,
               latencyMs,
               attempt,
            });
            return true;
         } catch (error) {
            const latencyMs = Date.now() - startMs;
            this.circuitBreaker.onFailure();
            this.incrementMetrics({ failed: 1 });

            logger.error("[EventProducer] Failed to publish message", {
               queue: this.queueName,
               messageId: eventData.messageId,
               correlationId,
               latencyMs,
               attempt,
               error,
            });

            if (!this.retryStrategy.shouldRetry(attempt)) {
               logger.error("[EventProducer] Max retry attempts reached, giving up on message", {
                  queue: this.queueName,
                  messageId: eventData.messageId,
                  correlationId,
                  attempt,
               });
               throw error;
            }

            const retryDelay = this.retryStrategy.getRetryDelay(attempt);
            logger.info(`[EventProducer] Waiting ${retryDelay}ms before retrying`, {
               queue: this.queueName,
               messageId: eventData.messageId,
               correlationId,
               attempt,
               retryDelay,
            });
            await this.retryStrategy.waitForRetry(attempt);
            attempt++;
         }
      }
   }
}
