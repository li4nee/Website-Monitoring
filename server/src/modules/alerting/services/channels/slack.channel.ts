import https from "https";
import http from "http";
import logger from "../../../../shared/config/logger.config";
import { IAlertChannel, DispatchPayload } from "./channel.interface";

export class SlackChannel implements IAlertChannel {
   readonly type = "slack";

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

   async dispatch(config: Record<string, unknown>, payload: DispatchPayload): Promise<void> {
      const webhookUrl = config.webhook_url as string;
      if (!webhookUrl) {
         logger.warn("[SlackChannel] Missing 'webhook_url' in config. Skipping.");
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
      logger.info(`[SlackChannel] Dispatched for alert ${payload.alert.id}`);
   }
}
