import mongoose, { HydratedDocument, InferSchemaType, Model } from "mongoose";
import { PasswordUtils } from "../utils/password.utils";
import { USER_ROLE } from "../typings/base.typings";

const userSchema = new mongoose.Schema(
   {
      username: {
         type: String,
         required: true,
         unique: true,
         trim: true,
         minLength: 3,
         validate: {
            validator: function (t: string) {
               // Don't allow spaces or symbols in the username except underscore
               return /^[a-zA-Z0-9_]+$/.test(t);
            },
            message: "Username can only contain letters, numbers, and underscores.",
         },
      },

      email: {
         type: String,
         required: true,
         unique: true,
         trim: true,
         lowercase: true,
         validate: {
            validator: function (e: string) {
               return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(e);
            },
            message: "Please enter a valid email address.",
         },
      },

      password: {
         type: String,
         required: true,
         minLength: 8,
         trim: true,
         validate: {
            validator: function (password: string) {
               // Already hashed password chai $2b$ bata start huncha, so if the password is already hashed and not changed, skip validation
               if (this.isModified("password") && password && !password.startsWith("$2b$")) {
                  const result = PasswordUtils.validateUserPasswordInput(password);
                  return result;
               }
               return true; // If the password is not modified, consider it valid
            },
            message:
               "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.",
         },
      },

      role: {
         type: String,
         enum: USER_ROLE,
         default: USER_ROLE.CLIENT_USER,
      },

      clientId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: "Client",
         // For super admin not needed clientId
         required: function () {
            return this.role !== USER_ROLE.SUPER_ADMIN;
         },
      },

      permissions: {
         canCreateApiKeys: {
            type: Boolean,
            default: false,
         },

         canManageUsers: {
            type: Boolean,
            default: false,
         },

         canViewRawLogs: {
            type: Boolean,
            default: false,
         },

         canViewAnalytics: {
            type: Boolean,
            default: false,
         },

         canManageSettings: {
            type: Boolean,
            default: false,
         },

         canExportData: {
            type: Boolean,
            default: false,
         },
      },

      isActive: {
         type: Boolean,
         default: true,
      },

      trash: {
         type: Boolean,
         default: false,
      },
   },
   {
      timestamps: true,
      collection: "users",
   },
);

export type User = InferSchemaType<typeof userSchema>;

export type UserDocument = HydratedDocument<User>;

userSchema.pre("save", async function (this: UserDocument) {
   if (!this.isModified("password")) return;

   this.password = await PasswordUtils.hashPassword(this.password);
});

// Most of the time they are queried together. So makes sense indexing them together.
userSchema.index({ clientId: 1, isActive: 1 });
userSchema.index({ role: 1, isActive: 1 });

export const UserModel: Model<User> = mongoose.model<User>("User", userSchema);
