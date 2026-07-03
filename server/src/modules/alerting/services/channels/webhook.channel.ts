import https from "https";
import http from "http";
import logger from "../../../../shared/config/logger.config";
import { IAlertChannel, DispatchPayload } from "./channel.interface";

export class WebhookChannel implements IAlertChannel {
   readonly type = "webhook";

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
      const url = config.url as string;
      if (!url) {
         logger.warn("[WebhookChannel] Missing 'url' in config. Skipping.");
         return;
      }
      await this.postJson(url, payload);
      logger.info(`[WebhookChannel] Dispatched to ${url} for alert ${payload.alert.id}`);
   }
}
