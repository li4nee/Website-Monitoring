import mongoose from "mongoose";
import { globalConfig } from "../../../config/global.config";
import logger from "../../../config/logger.config";

/**
 * MongoDb connection manager class.Semi singleton
 */
export class MongoConnection {
   private connection: mongoose.Connection | null;
   constructor() {
      this.connection = null;
   }

   /**
    * Connects to MongoDB using Mongoose. If a connection already exists, it returns the existing connection.
    * @returns {Promise<mongoose.Connection>}
    */
   public async connect(): Promise<mongoose.Connection> {
      try {
         if (this.connection) {
            logger.info("MongoDB connection already established.");
            return this.connection;
         }

         await mongoose.connect(globalConfig.mongo.url, {
            dbName: globalConfig.mongo.dbName,
         });
         logger.info("New MongoDB connection established successfully.");
         this.connection = mongoose.connection;

         this.connection.on("error", (err) => {
            logger.error("MongoDB connection error: %o", err);
         });

         this.connection.on("disconnected", () => {
            logger.error("MongoDB connection disconnected.");
         });

         return this.connection;
      } catch (error) {
         logger.error("Error connecting to MongoDB: %o", error);
         throw error;
      }
   }

   /**
    * Disconnects from MongoDB if a connection exists.
    * @returns {Promise<void>}
    */
   public async disconnect(): Promise<void> {
      try {
         if (this.connection) {
            await mongoose.disconnect();
            logger.info("MongoDB connection disconnected successfully.");
            this.connection = null;
         } else {
            logger.warn("No MongoDB connection to disconnect.");
         }
      } catch (error) {
         logger.error("Error disconnecting from MongoDB: %o", error);
         throw error;
      }
   }

   /**
    * Returns the current MongoDB connection if it exists, otherwise returns null.
    * @returns {mongoose.Connection | null}
    */
   getConnection(): mongoose.Connection | null {
      return this.connection;
   }

   getConnectionStatus(): string {
      if (this.connection) {
         switch (this.connection.readyState) {
            case 0:
               return "disconnected";
            case 1:
               return "connected";
            case 2:
               return "connecting";
            case 3:
               return "disconnecting";
            default:
               return "unknown";
         }
      }
      return "not connected";
   }
}

export default new MongoConnection();
