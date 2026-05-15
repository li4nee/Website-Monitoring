import { globalConfig } from "../../../shared/config/global.config";
import logger from "../../../shared/config/logger.config";
import { MongoConnection } from "../../../shared/infra/db/mongo/mongoConnection";
import { PostgresConnection } from "../../../shared/infra/db/postgres/postgresConnection";
import { ResourceNotInitializedError } from "../../../shared/typings/error.typings";
import { AlertingBaseRepo } from "../repos/alertingBase.repo";
import { AlertingDocument } from "../../../shared/infra/db/mongo/models/alerting.model";
import { AlertEvaluatorService } from "../services/alertEvaluator.service";
import { AlertDispatcherService } from "../services/alertDispatcher.service";
import { AlertFireLogService } from "../services/alertFireLog.service";

const POLL_INTERVAL_MS = globalConfig.alertingWorker.pollIntervalMs;
const DB_MAX_RETRY_ATTEMPTS = globalConfig.alertingWorker.mongoPostgresConnectionMaxRetryAttempts;

interface AlertingWorkerStats {
   totalCycles: number;
   totalEvaluated: number;
   totalFired: number;
   totalSkippedCooldown: number;
   totalErrors: number;
   lastCycleAt: string | null;
   lastFiredAlertId: string | null;
}

export class AlertingWorker {
   private alertingRepo: AlertingBaseRepo<AlertingDocument>;
   private evaluator: AlertEvaluatorService;
   private dispatcher: AlertDispatcherService;
   private fireLogService: AlertFireLogService;
   private mongoDBConnection: MongoConnection;
   private postgresConnection: PostgresConnection;

   private isRunning = false;
   private pollTimer: NodeJS.Timeout | null = null;

   private stats: AlertingWorkerStats = {
      totalCycles: 0,
      totalEvaluated: 0,
      totalFired: 0,
      totalSkippedCooldown: 0,
      totalErrors: 0,
      lastCycleAt: null,
      lastFiredAlertId: null,
   };

   constructor({
      alertingRepo,
      evaluator,
      dispatcher,
      fireLogService,
      mongoDBConnection,
      postgresConnection,
   }: {
      alertingRepo: AlertingBaseRepo<AlertingDocument>;
      evaluator: AlertEvaluatorService;
      dispatcher: AlertDispatcherService;
      fireLogService: AlertFireLogService;
      mongoDBConnection: MongoConnection;
      postgresConnection: PostgresConnection;
   }) {
      if (!alertingRepo || !evaluator || !dispatcher || !fireLogService || !mongoDBConnection || !postgresConnection) {
         throw new ResourceNotInitializedError("[AlertingWorker] All dependencies must be provided.");
      }
      this.alertingRepo = alertingRepo;
      this.evaluator = evaluator;
      this.dispatcher = dispatcher;
      this.fireLogService = fireLogService;
      this.mongoDBConnection = mongoDBConnection;
      this.postgresConnection = postgresConnection;
   }

   private async connectToDatabase(): Promise<void> {
      let attempt = 0;

      while (attempt < DB_MAX_RETRY_ATTEMPTS) {
         try {
            await Promise.all([this.mongoDBConnection.connect(), this.postgresConnection.testConnection()]);
            logger.info("[AlertingWorker] Connected to DBs", { attempt: attempt + 1 });
            return;
         } catch (error) {
            attempt++;
            logger.error("[AlertingWorker] DB connection failed", { attempt, error: (error as Error).message });

            if (attempt >= DB_MAX_RETRY_ATTEMPTS) {
               throw new ResourceNotInitializedError("[AlertingWorker] DB connection failed after max retries");
            }

            const delay = Math.min(1000 * 2 ** attempt, 5000);
            await new Promise((res) => setTimeout(res, delay));
         }
      }
   }

   private async runEvaluationCycle(): Promise<void> {
      logger.info("[AlertingWorker] Starting evaluation cycle");

      let cursor: string | undefined;
      let cycleEvaluated = 0;
      let cycleFired = 0;

      do {
         let data: AlertingDocument[];
         let nextCursor: string | undefined;

         try {
            const result = await this.alertingRepo.findEnabled(100, cursor);
            data = result.data;
            nextCursor = result.nextCursor;
         } catch (error) {
            logger.error("[AlertingWorker] Error fetching enabled alerts", { error });
            this.stats.totalErrors++;
            break;
         }

         for (const alert of data) {
            try {
               if (this.fireLogService.isInCooldown(alert)) {
                  logger.info(`[AlertingWorker] Alert ${alert._id} is in cooldown, skipping`);
                  this.stats.totalSkippedCooldown++;
                  continue;
               }

               const result = await this.evaluator.evaluate(alert);
               cycleEvaluated++;
               this.stats.totalEvaluated++;

               if (result.fired) {
                  cycleFired++;
                  this.stats.totalFired++;
                  this.stats.lastFiredAlertId = alert._id.toString();
                  logger.info(`[AlertingWorker] Alert ${alert._id} fired`, { reasons: result.reasons });
                  const channelsNotified = await this.dispatcher.dispatch(alert, result);
                  await this.fireLogService.recordFire(alert, result, channelsNotified);
               }
            } catch (error) {
               logger.error(`[AlertingWorker] Error evaluating alert ${alert._id}`, { error });
               this.stats.totalErrors++;
            }
         }

         cursor = nextCursor;
      } while (cursor);

      this.stats.totalCycles++;
      this.stats.lastCycleAt = new Date().toISOString();
      logger.info(`[AlertingWorker] Evaluation cycle complete. Evaluated: ${cycleEvaluated}, Fired: ${cycleFired}`);
   }

   private schedulePoll(): void {
      this.pollTimer = setTimeout(async () => {
         if (!this.isRunning) return;

         try {
            await this.runEvaluationCycle();
         } catch (error) {
            logger.error("[AlertingWorker] Unhandled error in evaluation cycle", { error });
         }

         if (this.isRunning) {
            this.schedulePoll();
         }
      }, POLL_INTERVAL_MS);
   }

   async start(): Promise<void> {
      if (this.isRunning) return;

      this.isRunning = true;

      try {
         await this.connectToDatabase();
         logger.info("[AlertingWorker] Started. First evaluation cycle in " + POLL_INTERVAL_MS + "ms");
         // Run immediately on start, then schedule recurring polls
         await this.runEvaluationCycle();
         this.schedulePoll();
      } catch (error) {
         logger.error("[AlertingWorker] Failed to start", { error: (error as Error).message });
         await this.stop();
         throw error;
      }
   }

   async stop(): Promise<void> {
      this.isRunning = false;

      if (this.pollTimer) {
         clearTimeout(this.pollTimer);
         this.pollTimer = null;
      }

      try {
         await this.mongoDBConnection.disconnect();
         await this.postgresConnection.disconnect();
         logger.info("[AlertingWorker] Stopped");
      } catch (error) {
         logger.error("[AlertingWorker] Error during stop", { error: (error as Error).message });
      }
   }

   getStats(): AlertingWorkerStats & { isRunning: boolean } {
      return { ...this.stats, isRunning: this.isRunning };
   }
}
