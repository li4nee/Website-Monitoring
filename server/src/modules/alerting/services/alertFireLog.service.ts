import logger from "../../../shared/config/logger.config";
import { AlertFireLogDocument } from "../../../shared/infra/db/mongo/models/alertFireLog.model";
import { AlertingDocument } from "../../../shared/infra/db/mongo/models/alerting.model";
import { AlertConditions, EvaluationResult } from "./alertEvaluator.service";
import { AlertFireLogBaseRepo } from "../repos/alertFireLogBase.repo";
import { AlertingBaseRepo } from "../repos/alertingBase.repo";

const DEFAULT_COOLDOWN_MINUTES = 60;

export class AlertFireLogService {
   private fireLogRepo: AlertFireLogBaseRepo<AlertFireLogDocument>;
   private alertingRepo: AlertingBaseRepo<AlertingDocument>;

   constructor(fireLogRepo: AlertFireLogBaseRepo<AlertFireLogDocument>, alertingRepo: AlertingBaseRepo<AlertingDocument>) {
      this.fireLogRepo = fireLogRepo;
      this.alertingRepo = alertingRepo;
   }

   isInCooldown(alert: AlertingDocument): boolean {
      const conditions = (alert.conditions ?? {}) as AlertConditions;
      const cooldownMinutes = conditions.cooldown_minutes ?? DEFAULT_COOLDOWN_MINUTES;
      const lastFiredAt = alert.lastFiredAt as Date | null | undefined;

      if (!lastFiredAt) return false;

      const cooldownMs = cooldownMinutes * 60 * 1000;
      const elapsed = Date.now() - new Date(lastFiredAt).getTime();
      return elapsed < cooldownMs;
   }

   async recordFire(alert: AlertingDocument, result: EvaluationResult, channelsNotified: string[]): Promise<void> {
      const now = new Date();

      try {
         await this.fireLogRepo.create({
            alertId: alert._id,
            clientId: alert.clientId,
            firedAt: now,
            reasons: result.reasons,
            stats: result.stats,
            channelsNotified,
         });
      } catch (error) {
         logger.error(`[AlertFireLogService] Failed to create fire log for alert ${alert._id}`, { error });
         throw error;
      }

      try {
         await this.alertingRepo.update(alert._id.toString(), { lastFiredAt: now });
      } catch (error) {
         logger.error(`[AlertFireLogService] Failed to update lastFiredAt for alert ${alert._id}`, { error });
         // Non-fatal: fire log is written; cooldown may not suppress correctly next cycle but that is acceptable
      }
   }

   async getHistory(
      alertId: string,
      limit: number = 20,
      cursor?: string,
   ): Promise<{ data: AlertFireLogDocument[]; nextCursor?: string }> {
      return this.fireLogRepo.findByAlertId(alertId, limit, cursor);
   }
}
