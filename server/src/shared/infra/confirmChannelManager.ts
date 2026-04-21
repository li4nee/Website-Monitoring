import EventEmitter from "node:events";
import { ResourceNotInitializedError } from "../typings/error.typings";
import logger from "../config/logger.config";
import { ConfirmChannel, ChannelModel } from "amqplib";

export type AmqpConnection = {
   connect: () => Promise<{ connection: ChannelModel }>;
   connection?: ChannelModel;
};

/**
 * Confirm channel is a channel that supports publisher confirms, which allows the publisher to receive acknowledgments from the broker when messages are successfully published.
 */
export class ConfirmChannelManager extends EventEmitter {
   private amqp: AmqpConnection;
   private channel: ConfirmChannel | null = null;
   private isConnecting = false;

   private connectingWaiters: Array<{
      resolve: (ch: ConfirmChannel) => void;
      reject: (err: unknown) => void;
   }> = [];

   constructor(amqp: AmqpConnection) {
      super();
      this.amqp = amqp;
   }

   async getChannel(): Promise<ConfirmChannel> {
      if (this.channel) return this.channel;

      // If a connection attempt is already in progress, wait for it to complete.
      // Not using multiple connections at once cause yo confirm channel is like resource intensive.
      if (this.isConnecting) {
         return new Promise<ConfirmChannel>((resolve, reject) => {
            this.connectingWaiters.push({ resolve, reject });
         });
      }

      return this.connect();
   }

   async connect(): Promise<ConfirmChannel> {
      this.isConnecting = true;

      try {
         let connection: ChannelModel;

         if (this.amqp.connection) {
            connection = this.amqp.connection;
         } else {
            const base = await this.amqp.connect();
            if (!base.connection) {
               throw new ResourceNotInitializedError("AMQP connection is not initialized");
            }
            connection = base.connection;
         }

         const confirmChannel = await connection.createConfirmChannel();

         confirmChannel.on("close", () => {
            logger.error("[ConfirmChannelManager] Confirm channel closed");
            this.channel = null;
         });

         confirmChannel.on("error", (error: unknown) => {
            logger.error("[ConfirmChannelManager] Confirm channel error", { error });
            this.channel = null;
            this.emit("error", error);
         });

         /**
          * Ya nira rabbitmq le drain event emit hancha after sabai messages publish huncha.
          * Throwing ya nira custom event so ya matra haina we can use it dherai thau ma.
          * Why we need drain event ?
          * Load high bhayo bhane confirm channel le backpressure bhanne concept use garcha.
          * Backpressure bhaneko chai once channel is like near to full in it's capacity .
          * We wait till the channel sends all the messages.
          * Once the channel is ready to accept more messages, it emits a "drain" event.
          */

         confirmChannel.on("drain", () => this.emit("drain"));

         this.channel = confirmChannel;

         for (const waiter of this.connectingWaiters) {
            waiter.resolve(confirmChannel);
         }

         this.connectingWaiters = [];

         return confirmChannel;
      } catch (error) {
         for (const waiter of this.connectingWaiters) {
            waiter.reject(error);
         }
         this.connectingWaiters = [];
         throw error;
      } finally {
         this.isConnecting = false;
      }
   }

   async close(): Promise<void> {
      if (this.channel) {
         await this.channel.close();
         this.channel = null;
      }
   }
}
