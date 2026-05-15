import { AlertingDocument } from "../../../shared/infra/db/mongo/models/alerting.model";
import { AlertFireLogDocument } from "../../../shared/infra/db/mongo/models/alertFireLog.model";
import { AlertingBaseRepo } from "../repos/alertingBase.repo";
import { MongoAlertingRepo } from "../repos/alerting.repo";
import { AlertFireLogBaseRepo } from "../repos/alertFireLogBase.repo";
import { MongoAlertFireLogRepo } from "../repos/alertFireLog.repo";
import { AlertingController } from "../controllers/alerting.controller";
import { IAlertingService } from "../contracts/IAlertingService.contract";
import { AlertingService } from "../services/alerting.service";

export interface AlertingDependencies {
   repositories: {
      alertingRepo: AlertingBaseRepo<AlertingDocument>;
      fireLogRepo: AlertFireLogBaseRepo<AlertFireLogDocument>;
   };
   services: {
      alertingService: IAlertingService;
   };
   controllers: {
      alertingController: AlertingController;
   };
}

class AlertingDependencyContainer {
   static init(): AlertingDependencies {
      const repositories = {
         alertingRepo: new MongoAlertingRepo(),
         fireLogRepo: new MongoAlertFireLogRepo(),
      };
      const services = {
         alertingService: new AlertingService(repositories.alertingRepo, repositories.fireLogRepo),
      };
      const controllers = {
         alertingController: new AlertingController(services.alertingService),
      };
      return {
         repositories,
         services,
         controllers,
      };
   }
}

export { AlertingDependencyContainer };
export default AlertingDependencyContainer;
