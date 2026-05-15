import { globalConfig } from "../../../shared/config/global.config";
import logger from "../../../shared/config/logger.config";
import { ApiHitsWithId } from "../../../shared/infra/db/mongo/models/apiHits.model";
import { EndpointMetrics } from "../../../shared/infra/db/postgres/postgresTypes";
import { InvalidInputError, ResourceNotInitializedError } from "../../../shared/typings/error.typings";
import { EventDataType } from "../../../shared/typings/messaging.typings";
import { EventDataDto } from "../dto/eventData.dto";
import { ApiHitsBaseRepo } from "../repos/apiHitsBase.repo";
import { EndPointMetricsBaseRepo } from "../repos/endpointMetricsBase.repo";

export enum TimeBucketInterval {
   Hourly = "hourly",
   Daily = "daily",
   Minutely = "minutely",
}

export class ProcessorService {
   private apiHitRepo: ApiHitsBaseRepo<ApiHitsWithId>;
   private endPointMetricsRepo: EndPointMetricsBaseRepo<EndpointMetrics>;
   private postgresUpsertRetryAttempts: number;

   constructor(
      apiHitRepo: ApiHitsBaseRepo<ApiHitsWithId>,
      endPointMetricsRepo: EndPointMetricsBaseRepo<EndpointMetrics>,
      upsertRetryAttempts: number = globalConfig.consumer.postGresMetricUpsertRetryAttempts,
   ) {
      if (!apiHitRepo) {
         throw new ResourceNotInitializedError("[ProcessorService] ApiHits repository must be provided to ProcessorService");
      }
      if (!endPointMetricsRepo) {
         throw new ResourceNotInitializedError(
            "[ProcessorService] EndpointMetrics repository must be provided to ProcessorService",
         );
      }
      this.apiHitRepo = apiHitRepo;
      this.endPointMetricsRepo = endPointMetricsRepo;
      this.postgresUpsertRetryAttempts = upsertRetryAttempts;
   }

   /**
    *
    * @param timeStamp
    * @param interval
    * @returns Gives the time bucket of given timestamp for an interval.
    * 12:54 in hourly interval is 12:00
    * 01:01 in hourly interval is 01:00
    */
   private getTimeBucket(timeStamp: Date, interval: TimeBucketInterval): Date {
      const date = new Date(timeStamp);
      switch (interval) {
         case TimeBucketInterval.Hourly:
            date.setMinutes(0, 0, 0);
            break;
         case TimeBucketInterval.Daily:
            date.setHours(0, 0, 0, 0);
            break;
         case TimeBucketInterval.Minutely:
            date.setSeconds(0, 0);
            break;
         default:
            date.setMinutes(0, 0, 0);
      }
      return date;
   }

   /**
    * Upsert endpoint metrics with 1 time retry in case of failure to handle transient issues.
    */
   private async upsertEndpointMetricsWithRetry(eventData: EventDataType): Promise<void> {
      const timeBucket = this.getTimeBucket(new Date(eventData.timeStamp), TimeBucketInterval.Hourly);
      const metrixData: EndpointMetrics = {
         id: 0, // ignored in upsert
         client_id: eventData.clientId,
         service_name: eventData.serviceName,
         endpoint: eventData.endpoint,
         method: eventData.method,
         time_bucket: timeBucket,
         total_hits: 1,
         error_hits: eventData.statusCode >= 400 ? 1 : 0,
         min_latency: eventData.latencyMs,
         max_latency: eventData.latencyMs,
         total_latency: eventData.latencyMs,
         created_at: new Date(),
         updated_at: new Date(),
      };
      let lastError = null;
      for (let attempt = 0; attempt < this.postgresUpsertRetryAttempts; attempt++) {
         try {
            await this.endPointMetricsRepo.upsertEndpointMetrics(metrixData);
            return;
         } catch (error) {
            lastError = error;
            logger.warn(
               `[ProcessorService] Attempt ${attempt + 1} failed to upsert metrics for event ${eventData.eventId}. Error: ${error instanceof Error ? error.stack : error}`,
            );
            // 5 second delay before retrying . This to handle transient temporary issuses like db ko connection glitch or something like that.
            if (attempt < this.postgresUpsertRetryAttempts - 1) {
               await new Promise((resolve) => setTimeout(resolve, 5000));
            }
         }
      }
      if (lastError) {
         logger.error(
            `[ProcessorService] Failed to upsert metrics after ${this.postgresUpsertRetryAttempts} attempts for event ${eventData.eventId}. Error: ${lastError instanceof Error ? lastError.stack : lastError}`,
         );
         throw lastError;
      }
   }

   async processEvent(eventData: EventDataType): Promise<void> {
      const validatedData = EventDataDto.safeParse(eventData);
      let rawEventSaved = false;
      let inputValidationError = false;
      try {
         if (!validatedData.success) {
            logger.error(
               `[ProcessorService] Validation failed for event : ${eventData.eventId}. Errors: ${JSON.stringify(validatedData.error.issues)}`,
            );
            inputValidationError = true;
            throw new InvalidInputError(`Validation failed for event data: ${JSON.stringify(validatedData.error.issues)}`);
         }
         logger.info(
            `[ProcessorService] Processing event : ${eventData.eventId} for service named ${eventData.serviceName} with endpoint ${eventData.endpoint} with method ${eventData.method} at ${eventData.timeStamp} having status code ${eventData.statusCode} and latency ${eventData.latencyMs} ms`,
         );

         // Save to mongoDB. If failed then skip processing and saving to postgres.
         await this.apiHitRepo.createApiHit(validatedData.data);
         rawEventSaved = true;

         logger.info(`[ProcessorService] Raw Event : ${eventData.eventId} saved.`);

         // upsert metrics to pg. if this fail then also ok no problem.
         await this.upsertEndpointMetricsWithRetry(validatedData.data);

         logger.info(`[ProcessorService] Metrics for event : ${eventData.eventId} upserted to Postgres.`);
      } catch (error) {
         if (inputValidationError) {
            throw error;
         }
         if (!rawEventSaved) {
            logger.error("Failed to save raw event", {
               eventId: eventData.eventId,
               error: error instanceof Error ? error.stack : error,
            });
            throw error;
         }

         logger.error("Failed to upsert metrics for event", {
            eventId: eventData.eventId,
            error: error instanceof Error ? error.stack : error,
         });
      }
   }

   async cleanUpOldApiHits(daysToKeep: number): Promise<void> {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      try {
         await this.apiHitRepo.deleteOldApiHits(cutoffDate);
         logger.info(`[ProcessorService] Old metrics older than ${cutoffDate} deleted successfully.`);
      } catch (error) {
         logger.error(`[ProcessorService] Failed to delete old metrics older than ${cutoffDate}.`, {
            error: error instanceof Error ? error.stack : error,
         });
         throw error;
      }
   }
}
