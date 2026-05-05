import mongoose, { HydratedDocument, InferSchemaType, Types } from "mongoose";
import { HTTP_METHODS } from "../../../../typings/auth.typings";

const ApiHitSchema = new mongoose.Schema(
   {
      eventId: {
         type: String,
         required: true,
         trim: true,
         unique: true,
         index: true,
      },

      timestamp: {
         type: Date,
         required: true,
      },

      serviceName: {
         type: String,
         required: true,
         index: true,
         trim: true,
      },

      endPoint: {
         type: String,
         required: true,
         index: true,
         trim: true,
      },

      method: {
         type: String,
         enum: HTTP_METHODS,
         required: true,
      },

      statusCode: {
         type: Number,
         required: true,
         index: true,
      },

      latencyInMs: {
         type: Number,
         required: true,
      },

      clientId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: "Client",
         required: true,
         index: true,
      },
      apiKeyId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: "ApiKey",
         required: true,
         index: true,
      },
      ipV4: {
         type: String,
         trim: true,
         validate: {
            validator: function (ip: string) {
               return (
                  ip === "localhost" ||
                  /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
                     ip,
                  )
               );
            },
         },
      },

      ipV6: {
         type: String,
         trim: true,
         validate: {
            validator: function (ip: string) {
               return ip === "localhost" || /^(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$/.test(ip);
            },
         },
      },

      userAgent: {
         type: String,
         trim: true,
      },
   },
   { timestamps: true },
);

ApiHitSchema.index({ clientId: 1, serviceName: 1, endPoint: 1, timestamp: -1 });
ApiHitSchema.index({ clientId: 1, timestamp: -1, statusCode: 1 });
ApiHitSchema.index({ apiKeyId: 1, timestamp: -1 });
ApiHitSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

type ApiHit = InferSchemaType<typeof ApiHitSchema>;
export type ApiHitsWithId = ApiHit & { _id: Types.ObjectId };
export type ApiHitDocument = HydratedDocument<ApiHit>;
export const ApiHitModel = mongoose.model("ApiHit", ApiHitSchema);
