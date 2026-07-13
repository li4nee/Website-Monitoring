import https from "https";

export interface ResendEmailParams {
   apiKey: string;
   from: string;
   to: string | string[];
   subject: string;
   html: string;
}

/** Sends an email via the Resend HTTP API (https://resend.com/docs/api-reference/emails/send-email). */
export function sendViaResend(params: ResendEmailParams): Promise<void> {
   return new Promise((resolve, reject) => {
      const data = JSON.stringify({
         from: params.from,
         to: params.to,
         subject: params.subject,
         html: params.html,
      });

      const req = https.request(
         {
            hostname: "api.resend.com",
            path: "/emails",
            method: "POST",
            headers: {
               Authorization: `Bearer ${params.apiKey}`,
               "Content-Type": "application/json",
               "Content-Length": Buffer.byteLength(data),
            },
         },
         (res) => {
            let body = "";
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () => {
               if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                  resolve();
               } else {
                  reject(new Error(`Resend API responded ${res.statusCode}: ${body}`));
               }
            });
         },
      );

      req.on("error", reject);
      req.setTimeout(10000, () => {
         req.destroy(new Error("Resend API request timed out"));
      });
      req.write(data);
      req.end();
   });
}
