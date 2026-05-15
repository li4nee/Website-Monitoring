import mongoConnection from "../../../../shared/infra/db/mongo/mongoConnection";
import postgresConnection from "../../../../shared/infra/db/postgres/postgresConnection";
import { PgEndPointMetricsRepo } from "../../../processor/repos/endpointMetrics.repo";
import { MongoAlertingRepo } from "../../repos/alerting.repo";
import { MongoAlertFireLogRepo } from "../../repos/alertFireLog.repo";
import { AlertEvaluatorService } from "../../services/alertEvaluator.service";
import { AlertDispatcherService } from "../../services/alertDispatcher.service";
import { AlertFireLogService } from "../../services/alertFireLog.service";
import { AlertingWorker } from "../alertingWorker";

export interface AlertingWorkerDependenciesType {
   worker: AlertingWorker;
}

export class AlertingWorkerDependenciesContainer {
   static init(): AlertingWorkerDependenciesType {
      const alertingRepo = new MongoAlertingRepo();
      const fireLogRepo = new MongoAlertFireLogRepo();
      const endpointMetricsRepo = new PgEndPointMetricsRepo();

      const evaluator = new AlertEvaluatorService(endpointMetricsRepo);
      const dispatcher = new AlertDispatcherService();
      const fireLogService = new AlertFireLogService(fireLogRepo, alertingRepo);

      const worker = new AlertingWorker({
         alertingRepo,
         evaluator,
         dispatcher,
         fireLogService,
         mongoDBConnection: mongoConnection,
         postgresConnection: postgresConnection,
      });

      return { worker };
   }
}

export default AlertingWorkerDependenciesContainer;
