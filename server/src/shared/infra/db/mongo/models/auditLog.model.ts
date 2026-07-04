import mongoose, { HydratedDocument, InferSchemaType, Types } from "mongoose";

/**
 * Audit trail of admin/security-relevant mutations (API key created/revoked,
 * permissions changed, users/clients activated/deactivated, alert rules
 * created/updated/deleted, etc). Written fire-and-forget via AuditLogger —
 * see shared/utils/auditLogger.utils.ts — so a slow or failed audit write
 * never affects the request that triggered it.
 */
const auditLogSchema = new mongoose.Schema(
   {
      action: {
         type: String,
         required: true,
         trim: true,
         index: true,
      },

      actorId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: "User",
         required: true,
      },

      actorRole: {
         type: String,
         required: true,
      },

      // Tenant this action was scoped to. Omitted for platform-level actions
      // (e.g. onboarding a new client itself, which doesn't belong to one yet).
      clientId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: "Client",
         index: true,
      },

      targetType: {
         type: String,
      },

      targetId: {
         type: String,
      },

      // Small, non-sensitive context about the action (e.g. which permission
      // flags changed) — never store secrets/plaintext API keys here.
      metadata: {
         type: mongoose.Schema.Types.Mixed,
      },
   },
   {
      timestamps: true,
      collection: "audit_logs",
   },
);

auditLogSchema.index({ clientId: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });

type AuditLog = InferSchemaType<typeof auditLogSchema>;
export type AuditLogWithId = AuditLog & { _id: Types.ObjectId };
export type AuditLogDocument = HydratedDocument<AuditLog>;
export const AuditLogModel = mongoose.model("AuditLog", auditLogSchema);
