import { USER_ROLE, UserInsideAuthorizedRequest } from "../typings/auth.typings";
import { InvalidInputError, PermissionNotGranted } from "../typings/error.typings";

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

   static canViewRawLogs(user: UserInsideAuthorizedRequest, targetClientId: string): boolean {
      if (user.role === USER_ROLE.SUPER_ADMIN) {
         return true;
      }

      if (user.role === USER_ROLE.CLIENT_ADMIN || user.role === USER_ROLE.CLIENT_USER) {
         if (!user.clientId || user.clientId !== targetClientId) {
            throw new PermissionNotGranted("You are not authorized to view raw logs for this client.");
         }
         if (!user.permissions.canViewRawLogs) {
            throw new PermissionNotGranted("You do not have permission to view raw logs.");
         }
         return true;
      }

      throw new PermissionNotGranted("You are not authorized to view raw logs.");
   }

   static canExportData(user: UserInsideAuthorizedRequest, targetClientId: string): boolean {
      if (user.role === USER_ROLE.SUPER_ADMIN) {
         return true;
      }

      if (user.role === USER_ROLE.CLIENT_ADMIN || user.role === USER_ROLE.CLIENT_USER) {
         if (!user.clientId || user.clientId !== targetClientId) {
            throw new PermissionNotGranted("You are not authorized to export data for this client.");
         }
         if (!user.permissions.canExportData) {
            throw new PermissionNotGranted("You do not have permission to export data.");
         }
         return true;
      }

      throw new PermissionNotGranted("You are not authorized to export data.");
   }

   static canViewAnalytics(user: UserInsideAuthorizedRequest, targetClientId: string): boolean {
      // Super admin has full access to all clients.
      if (user.role === USER_ROLE.SUPER_ADMIN) {
         return true;
      }

      // Client admin and client user must belong to the same client and have the analytics permission.
      if (user.role === USER_ROLE.CLIENT_ADMIN || user.role === USER_ROLE.CLIENT_USER) {
         if (!user.clientId || user.clientId !== targetClientId) {
            throw new PermissionNotGranted("You are not authorized to view analytics for this client.");
         }
         if (!user.permissions.canViewAnalytics) {
            throw new PermissionNotGranted("You do not have permission to view analytics.");
         }
         return true;
      }

      throw new PermissionNotGranted("You are not authorized to view analytics.");
   }
}
