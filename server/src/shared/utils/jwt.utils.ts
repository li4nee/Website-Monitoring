import jwt, { SignOptions } from "jsonwebtoken";
import { StringValue } from "ms";
import { JsonWebTokenError } from "../typings/error.typings";
import { JwtPayload, MaskedJwtPayload, Permissions, USER_ROLE } from "../typings/base.typings";

export class JwtUtils {
   static PERMISSION_FLAGS: (keyof Permissions)[] = [
      "canCreateApiKeys",
      "canManageUsers",
      "canViewRawLogs",
      "canViewAnalytics",
      "canManageSettings",
      "canExportData",
   ];

   static generateToken(payload: JwtPayload, secret: string, expiresIn: StringValue | number): string {
      const options: SignOptions = { expiresIn };
      const maskedPayload: MaskedJwtPayload = {
         ...payload,
         permissions: this.maskPermissions(payload.permissions),
      };
      return jwt.sign(maskedPayload, secret, options);
   }

   private static verifyToken(token: string, secret: string): object | string {
      try {
         return jwt.verify(token, secret);
      } catch (error) {
         throw new JsonWebTokenError("Invalid token");
      }
   }

   static decodeToken(token: string,secret:string): JwtPayload | null {
      let maskedPayload: MaskedJwtPayload | null = null;
      try {
         maskedPayload = this.verifyToken(token,secret) as MaskedJwtPayload;
      } catch (error) {
         return null;
      }
      if (!maskedPayload || typeof maskedPayload === "string") {
         return null;
      }
      const { id, role, permissions } = maskedPayload;
      return {
         id,
         role,
         permissions: this.unmaskPermissions(permissions),
      };
   }

   private static maskPermissions(permissions: Permissions): number {
      return this.PERMISSION_FLAGS.reduce((mask, key, index) => {
         return mask | ((permissions[key] ? 1 : 0) << (this.PERMISSION_FLAGS.length - 1 - index));
      }, 0);
   }

   static unmaskPermissions(mask: number): Permissions {
      const perms: Partial<Permissions> = {};
      this.PERMISSION_FLAGS.forEach((key, index) => {
         const bit = (mask >> (this.PERMISSION_FLAGS.length - 1 - index)) & 1;
         perms[key] = !!bit;
      });
      return perms as Permissions;
   }
}

