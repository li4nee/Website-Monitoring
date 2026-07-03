import nodemailer from "nodemailer";
import logger from "../../../../shared/config/logger.config";
import { globalConfig } from "../../../../shared/config/global.config";
import { IAlertChannel, DispatchPayload } from "./channel.interface";

export class EmailChannel implements IAlertChannel {
   readonly type = "email";

   private transport = nodemailer.createTransport({
      host: globalConfig.email.host,
      port: globalConfig.email.port,
      secure: globalConfig.email.secure,
      auth: globalConfig.email.user
         ? { user: globalConfig.email.user, pass: globalConfig.email.pass }
         : undefined,
   });

   private buildHtml(payload: DispatchPayload): string {
      const statsLine = `Hits: ${payload.stats.total_hits} | Errors: ${payload.stats.total_errors} | Error Rate: ${payload.stats.error_rate}% | Avg Latency: ${payload.stats.avg_latency}ms`;
      const reasonsList = payload.reasons.map((r) => `<li>${r}</li>`).join("");

      return `
         <h2>Alert Fired: ${payload.alert.name}</h2>
         <table>
            <tr><td><strong>Alert ID</strong></td><td>${payload.alert.id}</td></tr>
            <tr><td><strong>Alert Type</strong></td><td>${payload.alert.alertType}</td></tr>
            <tr><td><strong>Client ID</strong></td><td>${payload.alert.clientId}</td></tr>
            <tr><td><strong>Fired At</strong></td><td>${payload.firedAt}</td></tr>
            <tr><td><strong>Stats</strong></td><td>${statsLine}</td></tr>
         </table>
         <h3>Reasons</h3>
         <ul>${reasonsList}</ul>
      `;
   }

   async dispatch(config: Record<string, unknown>, payload: DispatchPayload): Promise<void> {
      const to = config.to as string | string[];
      if (!to || (Array.isArray(to) && to.length === 0)) {
         logger.warn("[EmailChannel] Missing 'to' in config. Skipping.");
         return;
      }

      const from = (config.from as string) || globalConfig.email.defaultFrom;
      const subject = (config.subject as string) || `Alert Fired: ${payload.alert.name}`;

      await this.transport.sendMail({
         from,
         to: Array.isArray(to) ? to.join(", ") : to,
         subject,
         html: this.buildHtml(payload),
      });

      logger.info(`[EmailChannel] Email dispatched to ${Array.isArray(to) ? to.join(", ") : to} for alert ${payload.alert.id}`);
   }
}
