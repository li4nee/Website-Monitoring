import { UserInsideAuthorizedRequest } from "../../../shared/typings/auth.typings";
import { AlertingDocument } from "../../../shared/infra/db/mongo/models/alerting.model";
import { AlertFireLogDocument } from "../../../shared/infra/db/mongo/models/alertFireLog.model";
import { CreateAlertDTOType } from "../dtos/createAlert.dto";
import { UpdateAlertDTOType } from "../dtos/updateAlert.dto";
import { AlertHistoryQueryDTOType, ListAlertsQueryDTOType } from "../dtos/listAlerts.dto";
import { IncidentFeedItem } from "../dtos/incidentFeed.dto";

export interface IAlertingService {
   createAlert(user: UserInsideAuthorizedRequest, clientId: string, data: CreateAlertDTOType): Promise<AlertingDocument>;
   listAlerts(
      user: UserInsideAuthorizedRequest,
      query: ListAlertsQueryDTOType,
   ): Promise<{ data: AlertingDocument[]; nextCursor?: string }>;
   getAlert(user: UserInsideAuthorizedRequest, clientId: string, alertId: string): Promise<AlertingDocument>;
   updateAlert(
      user: UserInsideAuthorizedRequest,
      clientId: string,
      alertId: string,
      data: UpdateAlertDTOType,
   ): Promise<AlertingDocument>;
   deleteAlert(user: UserInsideAuthorizedRequest, clientId: string, alertId: string): Promise<void>;
   setEnabled(
      user: UserInsideAuthorizedRequest,
      clientId: string,
      alertId: string,
      isEnabled: boolean,
   ): Promise<AlertingDocument>;
   getAlertHistory(
      user: UserInsideAuthorizedRequest,
      clientId: string,
      alertId: string,
      query: AlertHistoryQueryDTOType,
   ): Promise<{ data: AlertFireLogDocument[]; nextCursor?: string }>;
   getIncidents(
      user: UserInsideAuthorizedRequest,
      clientId: string,
      query: AlertHistoryQueryDTOType,
   ): Promise<{ data: IncidentFeedItem[]; nextCursor?: string }>;
}
