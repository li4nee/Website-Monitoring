import logger from "../../../shared/config/logger.config";
import { ApiKeyDocument, ApiKeyModel } from "../../../shared/models/apiKeys.model";
import { ApiKeyBaseRepo } from "./apiKeyBase.repo";

export class MongoApiKeyRepo extends ApiKeyBaseRepo<ApiKeyDocument> {
   private model = ApiKeyModel;

   async create(data: Partial<ApiKeyDocument>): Promise<ApiKeyDocument> {
      try {
         const apiKey = await this.model.create(data);
         logger.info(`API key created: ${apiKey._id}`);
         return apiKey;
      } catch (error) {
         logger.error("Error creating API key", { error });
         throw error;
      }
   }

   async delete(id: string): Promise<void> {
      try {
         await this.model.findByIdAndDelete(id);
         logger.info(`API key deleted: ${id}`);
      } catch (error) {
         logger.error(`Error deleting API key: ${id}`, { error });
         throw error;
      }
   }

   async findByKeyValue(keyValue: string, isActive: boolean, checkExpiry: boolean): Promise<ApiKeyDocument | null> {
      try {
         const now = new Date();
         const filter: any = { keyValue, isActive };

         if (checkExpiry) {
            filter.expiresAt = { $gt: now };
         }

         const apiKey = await this.model.findOne(filter).select("-__v").populate("clientId");
         if (apiKey) {
            logger.info(`API key found by key value: ${keyValue}`);
         } else {
            logger.warn(`No API key found for key value: ${keyValue}`);
         }
         return apiKey;
      } catch (error) {
         logger.error(`Error finding API key by key value: ${keyValue}`, { error });
         throw error;
      }
   }

   async findByClientId(clientId: string, isActive: boolean, checkExpiry: boolean): Promise<ApiKeyDocument[]> {
      try {
         const now = new Date();
         const filter: any = { clientId, isActive };

         if (checkExpiry) {
            filter.expiresAt = { $gt: now };
         }

         const apiKeys = await this.model.find(filter).select("-__v").populate("clientId");
         logger.info(`API keys found for client ID: ${clientId}, count: ${apiKeys.length}`);
         return apiKeys;
      } catch (error) {
         logger.error(`Error finding API keys by client ID: ${clientId}`, { error });
         throw error;
      }
   }

   async findAll(
      filter: any = {},
      options: { limit?: number; cursor?: string; sort?: any } = {},
   ): Promise<{ data: ApiKeyDocument[]; nextCursor?: string }> {
      try {
         const limit = options.limit ?? 10;
         const sort = options.sort ?? { createdAt: -1 };

         if (options.cursor) {
            const cursorDate = new Date(options.cursor);

            // If decending then less than , if ascending then greater than
            const operator = sort.createdAt === 1 ? "$gt" : "$lt";

            filter.createdAt = {
               ...(filter.createdAt || {}),
               [operator]: cursorDate,
            };
         }

         const items = await this.model
            .find(filter)
            .sort(sort)
            .limit(limit + 1) // Fetch limit + 1 items to check if there is a next page
            .select("-__v");

         let nextCursor: string | undefined;
         let data: ApiKeyDocument[];

         if (items.length > limit) {
            nextCursor = items[limit].createdAt.toISOString();
            data = items.slice(0, limit); // return the first limit items
         } else {
            data = items;
         }

         return { data, nextCursor };
      } catch (error) {
         logger.error("Error fetching API keys with cursor pagination", { error, filter, options });
         throw error;
      }
   }
}
