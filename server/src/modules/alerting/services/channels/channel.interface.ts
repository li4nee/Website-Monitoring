import { EvaluationResult } from "../alertEvaluator.service";
import { AlertingDocument } from "../../../../shared/infra/db/mongo/models/alerting.model";

export interface DispatchPayload {
   alert: {
      id: string;
      name: string;
      alertType: string;
      clientId: string;
   };
   firedAt: string;
   reasons: string[];
   stats: EvaluationResult["stats"];
}

export interface IAlertChannel {
   readonly type: string;
   dispatch(config: Record<string, unknown>, payload: DispatchPayload, alert: AlertingDocument): Promise<void>;
}
