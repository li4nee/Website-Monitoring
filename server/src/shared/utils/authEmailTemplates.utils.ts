import { escapeHtml } from "./html.utils";

function wrapper(badgeColor: string, badgeText: string, heading: string, bodyHtml: string, buttonLabel: string, buttonUrl: string): string {
   return `
<!DOCTYPE html>
<html>
<head>
   <meta charset="utf-8" />
   <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:24px;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
   <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #eceef1;">
      <tr>
         <td style="height:4px;background:${badgeColor};line-height:0;font-size:0;">&nbsp;</td>
      </tr>
      <tr>
         <td style="padding:32px 32px 8px;">
            <div style="display:inline-block;padding:4px 10px;background:${badgeColor}1a;color:${badgeColor};font-size:12px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;border-radius:999px;margin-bottom:16px;">
               ${badgeText}
            </div>
            <h1 style="margin:0 0 12px;font-size:20px;line-height:1.35;color:#111318;">${heading}</h1>
            <div style="font-size:14px;line-height:1.6;color:#4b5563;">${bodyHtml}</div>
         </td>
      </tr>
      <tr>
         <td style="padding:8px 32px 32px;">
            <a href="${buttonUrl}" style="display:inline-block;padding:12px 24px;background:#111318;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">${buttonLabel}</a>
            <p style="margin:16px 0 0;font-size:12px;color:#9aa0a6;word-break:break-all;">
               Or paste this link into your browser:<br />
               <a href="${buttonUrl}" style="color:#6b7280;">${buttonUrl}</a>
            </p>
         </td>
      </tr>
      <tr>
         <td style="padding:18px 32px;background:#fafafa;border-top:1px solid #eceef1;">
            <p style="margin:0;font-size:12px;color:#9aa0a6;line-height:1.6;">
               Sent by ServerStats. If you didn't expect this email, you can safely ignore it.
            </p>
         </td>
      </tr>
   </table>
</body>
</html>`;
}

export function buildVerificationEmailHtml(verifyUrl: string): string {
   return wrapper(
      "#2563eb",
      "Verify your email",
      "Confirm your email address",
      "Click the button below to verify your email and activate your ServerStats account. This link expires in 24 hours.",
      "Verify email",
      escapeHtml(verifyUrl),
   );
}

export function buildPasswordResetEmailHtml(resetUrl: string): string {
   return wrapper(
      "#e5484d",
      "Password reset",
      "Reset your password",
      "We received a request to reset your ServerStats password. Click the button below to choose a new one. This link expires in 1 hour and can only be used once.",
      "Reset password",
      escapeHtml(resetUrl),
   );
}
