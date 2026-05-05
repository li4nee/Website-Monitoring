import { EventDataType } from "../../../shared/typings/messaging.typings";

/**
 * Base repository for Api Hits, defining the contract for data access operations.
 */
export abstract class ApiHitsBaseRepo<T> {
   abstract createApiHit(eventData:EventDataType): Promise<T>;
   abstract findWithFilters(
      filters: Partial<T>,
      limit: number,
      offset?: number,
      sortBy?: string,
      sortOrder?: "ASC" | "DESC",
   ): Promise<T[]>;
   abstract countApiHitsByClientId(clientId: string): Promise<number>;
   abstract deleteOldApiHits(olderThan: Date): Promise<void>;
}
