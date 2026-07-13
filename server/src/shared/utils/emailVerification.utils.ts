import crypto from "crypto";
import { globalConfig } from "../config/global.config";
import logger from "../config/logger.config";
import { sendViaResend } from "./resendMailer.utils";
import { buildVerificationEmailHtml } from "./authEmailTemplates.utils";
import { UserWithId } from "../infra/db/mongo/models/user.model";
import { AuthTokenCache, EMAIL_VERIFICATION_TOKEN_PREFIX } from "../infra/cache/authTokenCache";

const VERIFICATION_TOKEN_TTL_SECONDS = 24 * 60 * 60; // 24 hours

function hashToken(rawToken: string): string {
   return crypto.createHmac("sha256", globalConfig.jwt.secret).update(rawToken).digest("hex");
}


export async function issueAndSendVerificationEmail(user: UserWithId): Promise<void> {
   try {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = hashToken(rawToken);

      await AuthTokenCache.store(EMAIL_VERIFICATION_TOKEN_PREFIX, tokenHash, user._id.toString(), VERIFICATION_TOKEN_TTL_SECONDS);

      if (!globalConfig.email.resendApiKey) {
         logger.warn("[EmailVerification] RESEND_API_KEY is not configured. Skipping verification email.", {
            userId: user._id.toString(),
         });
         return;
      }

      const verifyUrl = `${globalConfig.frontendUrl}/verify-email?token=${rawToken}`;

      await sendViaResend({
         apiKey: globalConfig.email.resendApiKey,
         from: globalConfig.email.defaultFrom,
         to: user.email,
         subject: "Verify your ServerStats email address",
         html: buildVerificationEmailHtml(verifyUrl),
      });

      logger.info(`[EmailVerification] Verification email sent to ${user.email}`);
   } catch (error) {
      logger.error("[EmailVerification] Failed to send verification email", { error, userId: user._id.toString() });
   }
}

export function hashVerificationOrResetToken(rawToken: string): string {
   return hashToken(rawToken);
}
