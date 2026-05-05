import { USER_ROLE, UserInsideAuthorizedRequest } from "../typings/auth.typings";
import { InvalidInputError } from "../typings/error.typings";

export class AuthorizationUtils {
   static canCreateClientUser(user: UserInsideAuthorizedRequest, targetClientId: string): boolean {
      // if super admin then full access.
      if (user.role === USER_ROLE.SUPER_ADMIN) {
         return true;
      }

      // if client admin then check if they belong to same client and have permission to manage users.
      if (user.role === USER_ROLE.CLIENT_ADMIN) {
         if (!user.clientId || user.clientId !== targetClientId) {
            throw new InvalidInputError("You are not authorized to create users for this client.");
         }
         if (!user.permissions.canManageUsers) {
            throw new InvalidInputError("You do not have permission to manage users.");
         }
         return true;
      }

      // Other roles cannot create users
      throw new InvalidInputError("You are not authorized to create client users.");
   }

   static canCreateApiKeys(user: UserInsideAuthorizedRequest, targetClientId: string): boolean {
      // if super admin then full access.
      if (user.role === USER_ROLE.SUPER_ADMIN) {
         return true;
      }

      // if client admin then check if they belong to same client and have permission to create API keys.
      if (user.role === USER_ROLE.CLIENT_ADMIN) {
         if (!user.clientId || user.clientId !== targetClientId) {
            throw new InvalidInputError("You are not authorized to create API keys for this client.");
         }
         if (!user.permissions.canCreateApiKeys) {
            throw new InvalidInputError("You do not have permission to create API keys.");
         }
         return true;
      }

      // Other roles cannot create API keys
      throw new InvalidInputError("You are not authorized to create API keys for clients.");
   }
}
