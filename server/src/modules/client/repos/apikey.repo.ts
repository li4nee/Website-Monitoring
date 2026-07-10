import logger from "../../../shared/config/logger.config";
import { ApiKeyModel, ApiKeyWithId } from "../../../shared/infra/db/mongo/models/apiKeys.model";
import { ApiKeyBaseRepo } from "./apiKeyBase.repo";
import { Types } from "mongoose";

export class MongoApiKeyRepo extends ApiKeyBaseRepo<ApiKeyWithId> {
   private model = ApiKeyModel;

   async create(data: Omit<Partial<ApiKeyWithId>, "_id">): Promise<ApiKeyWithId> {
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

   async findByKeyId(keyId: string, isActive: boolean, checkExpiry: boolean): Promise<ApiKeyWithId | null> {
      try {
         const now = new Date();
         const filter: any = { keyId, isActive };

         if (checkExpiry) {
            filter.expiresAt = { $gt: now };
         }

         const apiKey = await this.model.findOne(filter).select("-__v").populate("clientId");
         return apiKey;
      } catch (error) {
         logger.error(`Error finding API key by keyId: ${keyId}`, { error });
         throw error;
      }
   }

   async findById(id: string): Promise<ApiKeyWithId | null> {
      try {
         const apiKey = await this.model.findById(id).select("-__v -keyValue");
         return apiKey ? (apiKey.toObject() as ApiKeyWithId | null) : null;
      } catch (error) {
         logger.error(`Error finding API key by id: ${id}`, { error });
         throw error;
      }
   }

   async findByKeyValue(keyValue: string, isActive: boolean, checkExpiry: boolean): Promise<ApiKeyWithId | null> {
      try {
         const now = new Date();
         const filter: any = { keyValue, isActive };

         if (checkExpiry) {
            filter.expiresAt = { $gt: now };
         }

         const apiKey = await this.model.findOne(filter).select("-__v").lean();
         return apiKey;
      } catch (error) {
         logger.error(`Error finding API key by key value: ${keyValue}`, { error });
         throw error;
      }
   }

   async findByClientId(clientId: string, isActive: boolean, checkExpiry: boolean): Promise<ApiKeyWithId[]> {
      try {
         const now = new Date();
         const filter: any = { clientId: new Types.ObjectId(clientId), isActive };

         if (checkExpiry) {
            filter.expiresAt = { $gt: now };
         }

         const apiKeys = await this.model.find(filter).select("-__v -keyValue").populate("clientId", "name slug");
         return apiKeys;
      } catch (error) {
         logger.error(`Error finding API keys by client ID: ${clientId}`, { error });
         throw error;
      }
   }

   async findAll(
      filter: any = {},
      options: { limit?: number; cursor?: string; sort?: any } = {},
   ): Promise<{ data: ApiKeyWithId[]; nextCursor?: string }> {
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
         let data: ApiKeyWithId[];

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
