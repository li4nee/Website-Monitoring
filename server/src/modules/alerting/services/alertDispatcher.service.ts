import https from "https";
import http from "http";
import logger from "../../../shared/config/logger.config";
import { AlertingDocument } from "../../../shared/infra/db/mongo/models/alerting.model";
import { EvaluationResult } from "./alertEvaluator.service";

interface DispatchPayload {
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

export class AlertDispatcherService {
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
         try {
            await this.dispatchChannel(channel.type as string, channel.config as Record<string, unknown>, payload);
            notified.push(channel.type as string);
         } catch (error) {
            logger.error(`[AlertDispatcherService] Failed to dispatch via ${channel.type} for alert ${alert._id}`, { error });
         }
      }

      return notified;
   }

   private async dispatchChannel(
      type: string,
      config: Record<string, unknown>,
      payload: DispatchPayload,
   ): Promise<void> {
      switch (type) {
         case "webhook":
            await this.dispatchWebhook(config, payload);
            break;
         case "slack":
            await this.dispatchSlack(config, payload);
            break;
         case "discord":
            await this.dispatchDiscord(config, payload);
            break;
         default:
            logger.warn(`[AlertDispatcherService] Channel type '${type}' is not yet implemented. Skipping.`);
      }
   }

   private postJson(url: string, body: unknown): Promise<void> {
      return new Promise((resolve, reject) => {
         const data = JSON.stringify(body);
         const parsedUrl = new URL(url);
         const isHttps = parsedUrl.protocol === "https:";
         const lib = isHttps ? https : http;

         const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: "POST",
            headers: {
               "Content-Type": "application/json",
               "Content-Length": Buffer.byteLength(data),
            },
         };

         const req = lib.request(options, (res) => {
            res.resume();
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
               resolve();
            } else {
               reject(new Error(`HTTP ${res.statusCode} from ${url}`));
            }
         });

         req.on("error", reject);
         req.setTimeout(10000, () => {
            req.destroy(new Error(`Request to ${url} timed out`));
         });
         req.write(data);
         req.end();
      });
   }

   private async dispatchWebhook(config: Record<string, unknown>, payload: DispatchPayload): Promise<void> {
      const url = config.url as string;
      if (!url) {
         logger.warn("[AlertDispatcherService] Webhook channel missing 'url' in config. Skipping.");
         return;
      }
      await this.postJson(url, payload);
      logger.info(`[AlertDispatcherService] Webhook dispatched to ${url} for alert ${payload.alert.id}`);
   }

   private async dispatchSlack(config: Record<string, unknown>, payload: DispatchPayload): Promise<void> {
      const webhookUrl = config.webhook_url as string;
      if (!webhookUrl) {
         logger.warn("[AlertDispatcherService] Slack channel missing 'webhook_url' in config. Skipping.");
         return;
      }
      const body = {
         text: `*Alert Fired: ${payload.alert.name}*`,
         attachments: [
            {
               color: "danger",
               fields: [
                  { title: "Client ID", value: payload.alert.clientId, short: true },
                  { title: "Alert Type", value: payload.alert.alertType, short: true },
                  { title: "Fired At", value: payload.firedAt, short: false },
                  { title: "Reasons", value: payload.reasons.join("\n"), short: false },
                  {
                     title: "Stats",
                     value: `Hits: ${payload.stats.total_hits} | Errors: ${payload.stats.total_errors} | Error Rate: ${payload.stats.error_rate}% | Avg Latency: ${payload.stats.avg_latency}ms`,
                     short: false,
                  },
               ],
            },
         ],
      };
      await this.postJson(webhookUrl, body);
      logger.info(`[AlertDispatcherService] Slack notification dispatched for alert ${payload.alert.id}`);
   }

   private async dispatchDiscord(config: Record<string, unknown>, payload: DispatchPayload): Promise<void> {
      const webhookUrl = config.webhook_url as string;
      if (!webhookUrl) {
         logger.warn("[AlertDispatcherService] Discord channel missing 'webhook_url' in config. Skipping.");
         return;
      }
      const body = {
         embeds: [
            {
               title: `Alert Fired: ${payload.alert.name}`,
               color: 15158332, // red
               fields: [
                  { name: "Client ID", value: payload.alert.clientId, inline: true },
                  { name: "Alert Type", value: payload.alert.alertType, inline: true },
                  { name: "Fired At", value: payload.firedAt, inline: false },
                  { name: "Reasons", value: payload.reasons.join("\n"), inline: false },
                  {
                     name: "Stats",
                     value: `Hits: ${payload.stats.total_hits} | Errors: ${payload.stats.total_errors} | Error Rate: ${payload.stats.error_rate}% | Avg Latency: ${payload.stats.avg_latency}ms`,
                     inline: false,
                  },
               ],
               timestamp: payload.firedAt,
            },
         ],
      };
      await this.postJson(webhookUrl, body);
      logger.info(`[AlertDispatcherService] Discord notification dispatched for alert ${payload.alert.id}`);
   }
}
