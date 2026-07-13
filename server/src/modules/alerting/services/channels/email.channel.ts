import logger from "../../../../shared/config/logger.config";
import { globalConfig } from "../../../../shared/config/global.config";
import { escapeHtml } from "../../../../shared/utils/html.utils";
import { sendViaResend } from "../../../../shared/utils/resendMailer.utils";
import { IAlertChannel, DispatchPayload } from "./channel.interface";

export class EmailChannel implements IAlertChannel {
   readonly type = "email";

   private formatFiredAt(iso: string): string {
      return new Date(iso).toLocaleString("en-US", {
         dateStyle: "medium",
         timeStyle: "short",
      });
   }

   private buildHtml(payload: DispatchPayload): string {
      const esc = (v: string) => escapeHtml(v);
      const alertTypeLabel = payload.alert.alertType.replace(/_/g, " ");

      const stat = (label: string, value: string) => `
         <td style="padding:16px 12px;text-align:center;background:#f9fafb;border:1px solid #eceef1;border-radius:8px;">
            <div style="font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#8a8f98;margin:0 0 6px;">${label}</div>
            <div style="font-size:20px;font-weight:700;color:#111318;line-height:1.2;">${value}</div>
         </td>`;

      const reasonsList = payload.reasons.map((r) => `<li style="margin:0 0 6px;color:#7a1f1f;">${esc(r)}</li>`).join("");

      return `
<!DOCTYPE html>
<html>
<head>
   <meta charset="utf-8" />
   <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:24px;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
   <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #eceef1;">
      <tr>
         <td style="height:4px;background:#e5484d;line-height:0;font-size:0;">&nbsp;</td>
      </tr>
      <tr>
         <td style="padding:28px 32px 20px;">
            <div style="display:inline-block;padding:4px 10px;background:#fdecec;color:#e5484d;font-size:12px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;border-radius:999px;margin-bottom:14px;">
               &#9888; Alert Fired
            </div>
            <h1 style="margin:0 0 6px;font-size:20px;line-height:1.35;color:#111318;">${esc(payload.alert.name)}</h1>
            <p style="margin:0;font-size:13px;color:#6b7280;">
               ${esc(alertTypeLabel)} &middot; fired ${esc(this.formatFiredAt(payload.firedAt))}
            </p>
         </td>
      </tr>
      <tr>
         <td style="padding:0 32px 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
               <tr>
                  ${stat("Total Hits", String(payload.stats.total_hits))}
                  <td style="width:8px;">&nbsp;</td>
                  ${stat("Errors", String(payload.stats.total_errors))}
               </tr>
               <tr><td colspan="3" style="height:8px;">&nbsp;</td></tr>
               <tr>
                  ${stat("Error Rate", `${payload.stats.error_rate}%`)}
                  <td style="width:8px;">&nbsp;</td>
                  ${stat("Avg Latency", `${payload.stats.avg_latency}ms`)}
               </tr>
            </table>
         </td>
      </tr>
      <tr>
         <td style="padding:0 32px 28px;">
            <div style="background:#fdecec;border:1px solid #f6cfcf;border-radius:8px;padding:16px 18px;">
               <div style="font-size:12px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;color:#e5484d;margin:0 0 8px;">Why this fired</div>
               <ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.5;">${reasonsList}</ul>
            </div>
         </td>
      </tr>
      <tr>
         <td style="padding:18px 32px;background:#fafafa;border-top:1px solid #eceef1;">
            <p style="margin:0;font-size:12px;color:#9aa0a6;line-height:1.6;">
               Alert ID <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${esc(payload.alert.id)}</span>
               &nbsp;&middot;&nbsp; Client <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${esc(payload.alert.clientId)}</span><br />
               Sent by ServerStats alerting
            </p>
         </td>
      </tr>
   </table>
</body>
</html>`;
   }

   async dispatch(config: Record<string, unknown>, payload: DispatchPayload): Promise<void> {
      const to = config.to as string | string[];
      if (!to || (Array.isArray(to) && to.length === 0)) {
         logger.warn("[EmailChannel] Missing 'to' in config. Skipping.");
         return;
      }

      if (!globalConfig.email.resendApiKey) {
         logger.warn("[EmailChannel] RESEND_API_KEY is not configured. Skipping.");
         return;
      }

      const toList = Array.isArray(to) ? to : [to];
      const from = (config.from as string) || globalConfig.email.defaultFrom;
      const subject = (config.subject as string) || `Alert Fired: ${payload.alert.name}`;

      await sendViaResend({
         apiKey: globalConfig.email.resendApiKey,
         from,
         to: toList,
         subject,
         html: this.buildHtml(payload),
      });

      logger.info(`[EmailChannel] Email dispatched via Resend to ${toList.join(", ")} for alert ${payload.alert.id}`);
   }
}
