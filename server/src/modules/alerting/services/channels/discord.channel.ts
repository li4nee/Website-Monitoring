import https from "https";
import http from "http";
import logger from "../../../../shared/config/logger.config";
import { IAlertChannel, DispatchPayload } from "./channel.interface";

export class DiscordChannel implements IAlertChannel {
   readonly type = "discord";

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
         logger.warn("[DiscordChannel] Missing 'webhook_url' in config. Skipping.");
         return;
      }

      const body = {
         embeds: [
            {
               title: `Alert Fired: ${payload.alert.name}`,
               color: 15158332,
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
      logger.info(`[DiscordChannel] Dispatched for alert ${payload.alert.id}`);
   }
}
