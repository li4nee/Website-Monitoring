import mongoose, { HydratedDocument, InferSchemaType } from "mongoose";

const alertFireLogSchema = new mongoose.Schema(
   {
      alertId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: "Alerting",
         required: true,
         index: true,
      },

      clientId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: "Client",
         required: true,
         index: true,
      },

      firedAt: {
         type: Date,
         required: true,
         default: () => new Date(),
      },

      reasons: {
         type: [String],
         required: true,
      },

      stats: {
         type: mongoose.Schema.Types.Mixed,
         required: true,
      },

      channelsNotified: {
         type: [String],
         default: [],
      },
   },
   {
      timestamps: false,
      collection: "alert_fire_logs",
   },
);

alertFireLogSchema.index({ alertId: 1, firedAt: -1 });
alertFireLogSchema.index({ clientId: 1, firedAt: -1 });

export type AlertFireLog = InferSchemaType<typeof alertFireLogSchema>;
export type AlertFireLogDocument = HydratedDocument<AlertFireLog>;
export const AlertFireLogModel = mongoose.model("AlertFireLog", alertFireLogSchema);
