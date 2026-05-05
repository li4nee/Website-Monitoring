import amqp from "amqplib";
import { globalConfig } from "../config/global.config";
import logger from "../config/logger.config";
import { ResourceNotFoundError } from "../typings/error.typings";

export enum AMQPConnectionStatus {
   CONNECTED = "connected",
   CONNECTING = "connecting",
   DISCONNECTED = "disconnected",
}
/**
 * AMQP connection manager class. Semi Singleton.
 */
class AMQPConnection {
   private connection: amqp.ChannelModel | null;
   private channel: amqp.Channel | null;
   private isConnecting: boolean;
   private connected: boolean;

   private readonly url: string;
   private readonly exchange: string;
   private readonly queue: string;

   private readonly dlExchange: string;
   private readonly dlQueue: string;
   private readonly dlqRoutingKey: string;

   constructor() {
      this.connection = null;
      this.channel = null;
      this.isConnecting = false;
      this.connected = false;
      this.url = globalConfig.amqp.url;
      this.exchange = globalConfig.amqp.exchange;
      this.queue = globalConfig.amqp.queue;
      this.dlExchange = `${globalConfig.amqp.exchange}_dl`;
      this.dlQueue = `${globalConfig.amqp.queue}_dl`;
      this.dlqRoutingKey = `${globalConfig.amqp.queue}_dl`;
   }

   private async assertExchange(exchange: string, type: string, options?: amqp.Options.AssertExchange): Promise<void> {
      this.checkIfChannelExists();
      await this.channel!.assertExchange(exchange, type, options);
   }

   private async assertQueue(queue: string, options?: amqp.Options.AssertQueue): Promise<void> {
      this.checkIfChannelExists();
      await this.channel!.assertQueue(queue, options);
   }

   private async bindQueue(queue: string, exchange: string, routingKey: string): Promise<void> {
      this.checkIfChannelExists();
      await this.channel!.bindQueue(queue, exchange, routingKey);
   }

   private checkIfChannelExists() {
      if (!this.channel) {
         logger.error("AMQP channel not found. Please establish a connection first.");
         throw new ResourceNotFoundError("AMQP channel not found. Please establish a connection first.");
      }
   }

   /**
    * Set up the dead-letter exchange and queue.
    * The dead-letter exchange will be used to route messages that are rejected or expired in the main queue to the dead-letter queue.
    */
   private async setupDLQ(): Promise<void> {
      await this.assertExchange(this.dlExchange, "direct", { durable: true });
      await this.assertQueue(this.dlQueue, { durable: true });
      await this.bindQueue(this.dlQueue, this.dlExchange, this.dlqRoutingKey);
      logger.info("AMQP dead-letter exchange and queue set up successfully.");
   }

   /**
    * Set up the main exchange and queue with dead-letter configuration.
    */
   private async setupMainQueue(): Promise<void> {
      await this.assertExchange(this.exchange, "direct", { durable: true });
      // Set up main queue with dead-letter exchange and routing key
      // When a message is rejected or expires in the main queue, it will be routed to the dead-letter queue
      await this.assertQueue(this.queue, {
         durable: true,
         arguments: {
            "x-dead-letter-exchange": this.dlExchange,
            "x-dead-letter-routing-key": this.dlqRoutingKey,
         },
      });
      await this.bindQueue(this.queue, this.exchange, this.queue);
      logger.info("AMQP main exchange and queue set up successfully.");
   }

   /**
    * Returns the AMQP channel.
    * If a connection is already established, it returns the existing channel.
    * If a connection is currently being established, it waits until the connection is established and then returns the channel.
    * If no connection exists, it establishes a new connection and returns the channel.
    * @returns {Promise<amqp.Channel>}
    */
   async connect(): Promise<amqp.Channel> {
      if (this.channel) {
         logger.info("AMQP channel already established.");
         return this.channel;
      }
      // If a connection is currently being established, wait until it's done and return the channel
      if (this.isConnecting) {
         logger.info("AMQP connection is currently being established. Please wait...");
         await new Promise((resolve) => {
            const checkInterval = setInterval(() => {
               if (this.channel) {
                  clearInterval(checkInterval);
                  resolve(null);
               }
            }, 100); // wait for 100ms before checking again
         });
      }

      try {
         this.isConnecting = true;
         logger.info("Establishing new AMQP connection");
         this.connection = await amqp.connect(this.url);
         this.channel = await this.connection.createChannel();
         logger.info("AMQP connection and channel established successfully.");
         await this.setupDLQ();
         await this.setupMainQueue();

         this.connection.on("error", (error) => {
            logger.error("AMQP connection error: %o", error);
            this.connection = null;
            this.channel = null;
            this.connected = false;
         });

         this.connection.on("close", () => {
            logger.warn("AMQP connection closed.");
            this.connection = null;
            this.channel = null;
            this.connected = false;
         });

         this.isConnecting = false;
         return this.channel;
      } catch (error) {
         this.isConnecting = false;
         logger.error("Error establishing AMQP connection: %o", error);
         throw error;
      }
   }

   async getChannel(): Promise<amqp.Channel | null> {
      return this.channel;
   }

   get Connection(): amqp.ChannelModel | null {
      return this.connection;
   }

   async getConnectionStatus(): Promise<AMQPConnectionStatus> {
      if (this.isConnecting) return AMQPConnectionStatus.CONNECTING;
      if (!this.connected) return AMQPConnectionStatus.DISCONNECTED;
      return AMQPConnectionStatus.CONNECTED;
   }

   /**
    * Closes the AMQP connection and channel if they exist.
    */
   async close(): Promise<void> {
      try {
         if (this.connection) {
            await this.connection.close();
            await this.channel?.close();
            logger.info("AMQP connection closed successfully.");
         }
         this.connection = null;
         this.channel = null;
      } catch (error) {
         logger.error("Error closing AMQP connection: %o", error);
         throw error;
      }
   }
}

export default new AMQPConnection();
