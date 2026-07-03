import amqp from "amqplib";
import { globalConfig } from "../../shared/config/global.config";
import logger from "../../shared/config/logger.config";
import { MongoConnection } from "../../shared/infra/db/mongo/mongoConnection";
import { ResourceNotInitializedError } from "../../shared/typings/error.typings";

export interface DLQMessage {
   originalMessage: unknown;
   error: string;
   failedAt: string;
}

interface DLQConsumerStats {
   received: number;
   requeued: number;
   discarded: number;
   lastReceivedAt: string | null;
}

export class DLQConsumer {
   private channel: amqp.Channel | null = null;
   private isRunning = false;
   private mongoDBConnection: MongoConnection;

   private readonly dlqName: string;
   private readonly mainQueueName: string;

   private stats: DLQConsumerStats = {
      received: 0,
      requeued: 0,
      discarded: 0,
      lastReceivedAt: null,
   };

   constructor(mongoDBConnection: MongoConnection) {
      this.mongoDBConnection = mongoDBConnection;
      this.dlqName = `${globalConfig.amqp.queue}_dl`;
      this.mainQueueName = globalConfig.amqp.queue;
   }

   private async connectToRabbitMQ(): Promise<void> {
      const connection = await amqp.connect(globalConfig.amqp.url);
      this.channel = await connection.createChannel();

      this.channel.on("error", (err) => {
         logger.error("[DLQConsumer] Channel error", { error: err.message });
      });

      this.channel.on("close", () => {
         logger.warn("[DLQConsumer] Channel closed");
      });

      // DL exchange + DL queue are already asserted by AMQPConnection on startup.
      // Assert here as well so the DLQ consumer can run independently.
      const dlExchange = `${globalConfig.amqp.exchange}_dl`;
      const dlRoutingKey = this.dlqName;

      await this.channel.assertExchange(dlExchange, "direct", { durable: true });
      await this.channel.assertQueue(this.dlqName, { durable: true });
      await this.channel.bindQueue(this.dlqName, dlExchange, dlRoutingKey);

      logger.info("[DLQConsumer] Connected to RabbitMQ and DLQ asserted");
   }

   private parseMessage(msg: amqp.ConsumeMessage): DLQMessage | null {
      try {
         return JSON.parse(msg.content.toString()) as DLQMessage;
      } catch {
         logger.error("[DLQConsumer] Failed to parse DLQ message content");
         return null;
      }
   }

   private shouldRequeue(msg: amqp.ConsumeMessage): boolean {
      // Only requeue if explicitly flagged via header; default is to inspect and discard.
      return msg.properties.headers?.["x-requeue"] === true;
   }

   private async handleMessage(msg: amqp.ConsumeMessage): Promise<void> {
      if (!this.channel) return;

      this.stats.received++;
      this.stats.lastReceivedAt = new Date().toISOString();

      const dlqReason = msg.properties.headers?.["x-dlq-reason"] ?? "unknown";
      const originalEventType = msg.properties.headers?.["x-original-event-type"] ?? "unknown";
      const originalTimestamp = msg.properties.headers?.["x-original-timestamp"];
      const messageId = msg.properties.messageId ?? "unknown";

      const parsed = this.parseMessage(msg);

      logger.error("[DLQConsumer] Dead letter received", {
         messageId,
         dlqReason,
         originalEventType,
         originalTimestamp: originalTimestamp ? new Date(Number(originalTimestamp)).toISOString() : null,
         error: parsed?.error,
         failedAt: parsed?.failedAt,
         originalMessage: parsed?.originalMessage,
      });

      if (this.shouldRequeue(msg)) {
         // Strip the requeue flag so it doesn't loop indefinitely
         const requeueHeaders = { ...msg.properties.headers };
         delete requeueHeaders["x-requeue"];

         this.channel.sendToQueue(this.mainQueueName, msg.content, {
            persistent: true,
            headers: requeueHeaders,
            messageId: msg.properties.messageId,
         });

         this.stats.requeued++;
         this.channel.ack(msg);
         logger.info(`[DLQConsumer] Message ${messageId} requeued to main queue`);
      } else {
         this.stats.discarded++;
         this.channel.ack(msg);
         logger.info(`[DLQConsumer] Message ${messageId} acknowledged and discarded from DLQ`);
      }
   }

   async start(): Promise<void> {
      if (this.isRunning) return;
      this.isRunning = true;

      await this.mongoDBConnection.connect();
      await this.connectToRabbitMQ();

      if (!this.channel) {
         throw new ResourceNotInitializedError("[DLQConsumer] Channel not initialized after connect");
      }

      this.channel.prefetch(10);

      await this.channel.consume(
         this.dlqName,
         async (msg) => {
            if (msg) await this.handleMessage(msg);
         },
         { noAck: false },
      );

      logger.info(`[DLQConsumer] Listening on DLQ: ${this.dlqName}`);
   }

   async stop(): Promise<void> {
      this.isRunning = false;
      try {
         await this.channel?.close();
         this.channel = null;
         await this.mongoDBConnection.disconnect();
         logger.info("[DLQConsumer] Stopped");
      } catch (error) {
         logger.error("[DLQConsumer] Error during stop", { error: (error as Error).message });
      }
   }

   getStats(): DLQConsumerStats {
      return { ...this.stats };
   }
}
