import { ClientBaseRepo } from "./clientBase.repo";
import logger from "../../../shared/config/logger.config";
import { ClientDocument, ClientModel } from "../../../shared/infra/db/mongo/models/client.model";

/**
 * MongoClientRepo handles CRUD for Client documents with Mongoose.
 * It extends ClientBaseRepo and implements create, update, delete, and fetch methods.
 */
export class MongoClientRepo extends ClientBaseRepo<ClientDocument> {
   private model = ClientModel;

   async create(data: Partial<ClientDocument>): Promise<ClientDocument> {
      try {
         const client = await this.model.create(data);
         logger.info(`Client created: ${client._id}`);
         return client;
      } catch (error) {
         logger.error("Error creating client", { error, data });
         throw error;
      }
   }

   async update(id: string, data: Partial<ClientDocument>): Promise<ClientDocument | null> {
      try {
         const updatedClient = await this.model.findByIdAndUpdate(id, data, { new: true });
         if (updatedClient) {
            logger.info(`Client updated: ${updatedClient._id}`);
         } else {
            logger.warn(`Client not found for update: ${id}`);
         }
         return updatedClient;
      } catch (error) {
         logger.error(`Error updating client: ${id}`, { error, data });
         throw error;
      }
   }

   async delete(id: string): Promise<void> {
      try {
         await this.model.findByIdAndDelete(id);
         logger.info(`Client deleted: ${id}`);
      } catch (error) {
         logger.error(`Error deleting client: ${id}`, { error });
         throw error;
      }
   }

   async findById(id: string, includeOnlyId: boolean = false): Promise<ClientDocument | null> {
      try {
         const selectFields = includeOnlyId ? "_id" : "-__v";
         const client = await this.model.findById(id).select(selectFields);
         return client;
      } catch (error) {
         logger.error(`Error finding client by ID: ${id}`, { error });
         throw error;
      }
   }

   async findBySlug(slug: string, includeOnlyId: boolean): Promise<ClientDocument | null> {
      try {
         const selectFields = includeOnlyId ? "_id" : "-__v";
         const client = await this.model.findOne({ slug }).select(selectFields);
         return client;
      } catch (error) {
         logger.error(`Error finding client by slug: ${slug}`, { error });
         throw error;
      }
   }

   async findAll(
      filter: any = {},
      options: { limit?: number; cursor?: string; sort?: any } = {},
   ): Promise<{ data: ClientDocument[]; nextCursor?: string }> {
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
         let data: ClientDocument[];

         if (items.length > limit) {
            nextCursor = items[limit].createdAt.toISOString();
            data = items.slice(0, limit); // return the first limit items
         } else {
            data = items;
         }

         logger.info("Fetched clients with cursor pagination", {
            count: data.length,
            nextCursor,
            filter,
         });

         return { data, nextCursor };
      } catch (error) {
         logger.error("Error fetching clients with cursor pagination", { error, filter, options });
         throw error;
      }
   }
}
