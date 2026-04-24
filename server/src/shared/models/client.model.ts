import mongoose, { HydratedDocument, InferSchemaType } from "mongoose";
import { time } from "node:console";

/**
 * Client Schema
 * Represents a client organization that can have multiple users and API keys.
 * Contains settings related to data retention, alerting, and timezone.
 */
const clientSchema = new mongoose.Schema(
   {
      name: {
         type: String,
         required: true,
         trim: true,
         minLength: 2,
         maxLength: 100,
      },

      email: {
         type: String,
         required: true,
         trim: true,
         lowercase: true,
         validate: {
            validator: function (e: string) {
               return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(e);
            },
         },
      },

      slug: {
         type: String,
         required: true,
         unique: true,
         trim: true,
         lowercase: true,
         match: /^[a-z0-9-]+$/,
      },

      description: {
         type: String,
         trim: true,
         maxLength: 500,
         default: "",
      },

      website: {
         type: String,
         trim: true,
         validate: {
            validator: function (w: string) {
               if (w.length === 0) return true; // If website is empty, consider it valid
               return /^(https?:\/\/)?([\w-]+(\.[\w-]+)+)(\/[\w-]*)*(\?.*)?(#.*)?$/.test(w);
            },
         },
      },

      createdBy: {
         type: mongoose.Schema.Types.ObjectId,
         ref: "User",
         required: true,
      },

      settings: {
         dataRetentionPeriod: {
            type: Number,
            default: 30, // Default data retention period in days
            min: 2,
            max: 365,
         },
         timezone: {
            type: String,
            default: "UTC",
            validate: {
               validator: function (t: string) {
                  return /^([+-](0[0-9]|1[0-4]):?([0-5][0-9])?|UTC|GMT)$/.test(t);
               },
               message: "Please enter a valid timezone offset (e.g., +05:30, -04:00, UTC, GMT).",
            },
         },
      },
      isActive: {
         type: Boolean,
         default: true,
      },
   },
   {
      timestamps: true,
      collection: "clients",
   },
);

clientSchema.index({ slug: 1 });
clientSchema.index({ isActive: 1 });

export type Client = InferSchemaType<typeof clientSchema>;
export type ClientWithId = Client & { _id: mongoose.Types.ObjectId };
export type ClientDocument = HydratedDocument<Client>;

export const ClientModel = mongoose.model("Client", clientSchema);
