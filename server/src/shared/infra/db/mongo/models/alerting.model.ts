import mongoose, { HydratedDocument, InferSchemaType } from "mongoose";

const alertingSchema = new mongoose.Schema(
   {
      clientId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: "Client",
         required: true,
         index: true,
      },

      name: {
         type: String,
         required: true,
         trim: true,
         maxlength: 100,
      },

      description: {
         type: String,
         trim: true,
         maxlength: 500,
      },

      isEnabled: {
         type: Boolean,
         default: true,
      },

      alertType: {
         type: String,
         enum: ["threshold", "daily_summary", "weekly_summary", "custom"],
         required: true,
      },

      channels: [
         {
            type: {
               type: String,
               enum: ["email", "webhook", "slack", "discord", "sms"],
               required: true,
            },
            config: {
               type: mongoose.Schema.Types.Mixed,
               required: true,
            },
         },
      ],

      conditions: {
         // Optional: store thresholds, metrics, or other rules for this alert
         type: mongoose.Schema.Types.Mixed,
      },

      createdBy: {
         type: mongoose.Schema.Types.ObjectId,
         ref: "User",
         required: true,
      },
   },
   {
      timestamps: true,
      collection: "alertings",
   },
);

alertingSchema.index({ clientId: 1, isEnabled: 1 });
alertingSchema.index({ alertType: 1, clientId: 1 });

export type Alerting = InferSchemaType<typeof alertingSchema>;
export type AlertingDocument = HydratedDocument<Alerting>;
export const AlertingModel = mongoose.model("Alerting", alertingSchema);
