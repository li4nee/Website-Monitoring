import mongoose, { HydratedDocument, InferSchemaType } from "mongoose";
import { DEVELOPMENT_ENVIRONMENT } from "../typings/base.typings";

const ApiKeySchema = new mongoose.Schema(
   {
      keyId: {
         type: String,
         required: true,
         unique: true,
         trim: true,
         index: true,
      },
      keyValue: {
         type: String,
         required: true,
         trim: true,
         index: true,
      },
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
      },
      description: {
         type: String,
         trim: true,
      },
      environment: {
         type: String,
         enum: DEVELOPMENT_ENVIRONMENT,
         default: DEVELOPMENT_ENVIRONMENT.DEVELOPMENT,
      },
      permissions: {
         writeAccess: {
            type: Boolean,
            default: false,
         },
         // cam read analytics
         readAccess: {
            type: Boolean,
            default: true,
         },

         allowedServices: [
            {
               type: String,
               trim: true,
            },
         ],
      },
      security: {
         allowedIPsIPV4: [
            {
               type: String,
               trim: true,
               validate: {
                  validator: function (ip: string) {
                     // Validate IPv4 address format or localhost
                     return /^(localhost|127\.0\.0\.1|(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?))$/.test(
                        ip,
                     );
                  },
               },
            },
         ],
         allowedIPsIPV6: [
            {
               type: String,
               trim: true,
               validate: {
                  validator: function (ip: string) {
                     // Validate IPv6 address format or localhost
                     return /^(localhost|::1|(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4})$/.test(ip);
                  },
               },
            },
         ],
         allowedOrigins: [
            {
               type: String,
               trim: true,
               validate: {
                  validator: function (origin: string) {
                     // Validate URL format for allowed origins or localhost
                     return /^(localhost|http:\/\/localhost(:\d+)?|(https?:\/\/)?([\w-]+(\.[\w-]+)+)(\/[\w-]*)*(\?.*)?(#.*)?)$/.test(
                        origin,
                     );
                  },
               },
            },
         ],
      },

      metaData: {
         createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
         },
         purpose: {
            type: String,
            trim: true,
            maxlength: 200,
         },
         tags: [
            {
               type: String,
               trim: true,
               maxlength: 50,
            },
         ],
      },
      lastRotatedAt: {
         type: Date,
         Default: Date.now,
      },
      rotationWarningPeriod: {
         type: Number,
         default: 30, // Default warning period in days before key rotation
      },
      isActive: {
         type: Boolean,
         default: true,
      },
      expiresAt: {
         type: Date,
         default: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Default expiration time of 1 year
         index: true,
      },
   },
   {
      timestamps: true,
      collection: "apikeys",
   },
);

ApiKeySchema.index({ clientId: 1, isActive: 1 });
ApiKeySchema.index({ keyValue: 1, isActive: 1 });
ApiKeySchema.index({ environment: 1, clientId: 1 });

type ApiKey = InferSchemaType<typeof ApiKeySchema>;
export type ApiKeyDocument = HydratedDocument<ApiKey>;

export const ApiKeyModel = mongoose.model("ApiKey", ApiKeySchema);
