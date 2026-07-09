import logger from "../../../shared/config/logger.config";
import { AlertingDocument } from "../../../shared/infra/db/mongo/models/alerting.model";
import { OverviewStats } from "../../analytics/dtos/analyticsResponse.dto";
import { EndPointMetricsBaseRepo } from "../../processor/repos/endpointMetricsBase.repo";
import { EndpointMetrics } from "../../../shared/infra/db/postgres/postgresTypes";
import { AlertEvaluationError } from "../../../shared/typings/error.typings";

export interface AlertConditions {
   error_rate_threshold?: number; // percentage, e.g. 5 means 5%
   avg_latency_threshold?: number; // milliseconds
   min_hits_threshold?: number; // minimum expected hits in window; fires if below
   lookback_minutes?: number; // how far back to look, default 60
   cooldown_minutes?: number; // suppress re-fires within this window, default 60
}

export interface EvaluationResult {
   fired: boolean;
   reasons: string[];
   stats: OverviewStats;
}

const EMPTY_STATS: OverviewStats = { total_hits: 0, total_errors: 0, error_rate: 0, avg_latency: 0, unique_endpoints: 0 };

export class AlertEvaluatorService {
   private endpointMetricsRepo: EndPointMetricsBaseRepo<EndpointMetrics>;

   constructor(endpointMetricsRepo: EndPointMetricsBaseRepo<EndpointMetrics>) {
      this.endpointMetricsRepo = endpointMetricsRepo;
   }

   async evaluate(alert: AlertingDocument): Promise<EvaluationResult> {
      switch (alert.alertType) {
         case "daily_summary":
            return this.evaluateSummary(alert, 24 * 60);
         case "weekly_summary":
            return this.evaluateSummary(alert, 7 * 24 * 60);
         case "threshold":
         case "custom":
         default:
            return this.evaluateThreshold(alert);
      }
   }

   private async evaluateSummary(alert: AlertingDocument, lookbackMinutes: number): Promise<EvaluationResult> {
      const clientId = alert.clientId.toString();
      const startTime = new Date(Date.now() - lookbackMinutes * 60 * 1000);

      let stats: OverviewStats;
      try {
         stats = await this.endpointMetricsRepo.getOverviewStats(clientId, startTime);
      } catch (error) {
         const evalError = new AlertEvaluationError(alert._id.toString(), `Failed to fetch stats for summary alert ${alert._id}`);
         logger.error(`[AlertEvaluatorService] ${evalError.message}`, { alertId: evalError.alertId, cause: error });
         return { fired: false, reasons: [], stats: EMPTY_STATS };
      }

      const label = lookbackMinutes >= 7 * 24 * 60 ? "Weekly" : "Daily";
      const reasons = [
         `${label} summary: ${stats.total_hits} hits, ${stats.total_errors} errors, ` +
            `${stats.error_rate}% error rate, ${stats.avg_latency}ms avg latency, ` +
            `${stats.unique_endpoints} unique endpoints`,
      ];

      return { fired: true, reasons, stats };
   }

   private async evaluateThreshold(alert: AlertingDocument): Promise<EvaluationResult> {
      const conditions = (alert.conditions ?? {}) as AlertConditions;
      const lookbackMinutes = conditions.lookback_minutes ?? 60;
      const startTime = new Date(Date.now() - lookbackMinutes * 60 * 1000);
      const clientId = alert.clientId.toString();

      let stats: OverviewStats;
      try {
         stats = await this.endpointMetricsRepo.getOverviewStats(clientId, startTime);
      } catch (error) {
         const evalError = new AlertEvaluationError(
            alert._id.toString(),
            `Failed to fetch stats for threshold alert ${alert._id}`,
         );
         logger.error(`[AlertEvaluatorService] ${evalError.message}`, { alertId: evalError.alertId, cause: error });
         return { fired: false, reasons: [], stats: EMPTY_STATS };
      }

      const reasons: string[] = [];

      if (conditions.error_rate_threshold !== undefined && stats.error_rate > conditions.error_rate_threshold) {
         reasons.push(`Error rate ${stats.error_rate.toFixed(2)}% exceeds threshold ${conditions.error_rate_threshold}%`);
      }

      if (conditions.avg_latency_threshold !== undefined && stats.avg_latency > conditions.avg_latency_threshold) {
         reasons.push(
            `Average latency ${stats.avg_latency.toFixed(2)}ms exceeds threshold ${conditions.avg_latency_threshold}ms`,
         );
      }

      if (conditions.min_hits_threshold !== undefined && stats.total_hits < conditions.min_hits_threshold) {
         reasons.push(`Total hits ${stats.total_hits} dropped below minimum threshold ${conditions.min_hits_threshold}`);
      }

      return { fired: reasons.length > 0, reasons, stats };
   }
}
