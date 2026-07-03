import logger from "../../../shared/config/logger.config";
import { AlertingDocument } from "../../../shared/infra/db/mongo/models/alerting.model";
import { EvaluationResult } from "./alertEvaluator.service";
import { IAlertChannel, DispatchPayload } from "./channels/channel.interface";
import { WebhookChannel } from "./channels/webhook.channel";
import { SlackChannel } from "./channels/slack.channel";
import { DiscordChannel } from "./channels/discord.channel";
import { EmailChannel } from "./channels/email.channel";

export class AlertDispatcherService {
   private channels: Map<string, IAlertChannel>;

   constructor() {
      const channelList: IAlertChannel[] = [
         new WebhookChannel(),
         new SlackChannel(),
         new DiscordChannel(),
         new EmailChannel(),
      ];
      this.channels = new Map(channelList.map((c) => [c.type, c]));
   }

   async dispatch(alert: AlertingDocument, result: EvaluationResult): Promise<string[]> {
      const payload: DispatchPayload = {
         alert: {
            id: alert._id.toString(),
            name: alert.name,
            alertType: alert.alertType,
            clientId: alert.clientId.toString(),
         },
         firedAt: new Date().toISOString(),
         reasons: result.reasons,
         stats: result.stats,
      };

      const notified: string[] = [];

      for (const channel of alert.channels) {
         const type = channel.type as string;
         const handler = this.channels.get(type);

         if (!handler) {
            logger.warn(`[AlertDispatcherService] Channel type '${type}' is not implemented. Skipping.`);
            continue;
         }

         try {
            await handler.dispatch(channel.config as Record<string, unknown>, payload, alert);
            notified.push(type);
         } catch (error) {
            logger.error(`[AlertDispatcherService] Failed to dispatch via ${type} for alert ${alert._id}`, { error });
         }
      }

      return notified;
   }
}
