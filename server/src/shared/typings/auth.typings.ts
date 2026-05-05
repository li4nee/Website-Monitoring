import { Request } from "express";
export enum CLIENT_ROLES {
   CLIENT_ADMIN = "client_admin",
   CLIENT_USER = "client_user",
}

export enum USER_ROLE {
   SUPER_ADMIN = "super_admin",
   CLIENT_ADMIN = "client_admin",
   CLIENT_USER = "client_user",
}

export enum DEVELOPMENT_ENVIRONMENT {
   PRODUCTION = "production",
   STAGING = "staging",
   DEVELOPMENT = "development",
   TESTING = "testing",
}

export enum HTTP_METHODS {
   GET = "GET",
   POST = "POST",
   PUT = "PUT",
   DELETE = "DELETE",
   PATCH = "PATCH",
   OPTIONS = "OPTIONS",
   HEAD = "HEAD",
}

export interface AuthorizedRequest extends Request {
   user?: UserInsideAuthorizedRequest;
}

export interface ClientAuthorizedRequest extends Request {
   client?: ClientInsideAuthorizedRequest;
   apiKey?: ApiKeyInsideAuthorizedRequest;
}

export interface UserInsideAuthorizedRequest {
   id: string;
   role: USER_ROLE;
   permissions: Permissions;
   clientId?: string;
}

export interface ClientInsideAuthorizedRequest {
   id: string;
   name: string;
   slug: string;
   ip?: string;
   userAgent?: string;
}

export interface ApiKeyInsideAuthorizedRequest {
   id: string;
   apiKeyId: string;
   name: string;
   permissions: {
      writeAccess: boolean;
      readAccess: boolean;
   };
}

export type Permissions = {
   canCreateApiKeys: boolean;
   canManageUsers: boolean;
   canViewRawLogs: boolean;
   canViewAnalytics: boolean;
   canManageSettings: boolean;
   canExportData: boolean;
};

export interface JwtPayload {
   id: string;
   role: USER_ROLE;
   permissions: Permissions;
   clientId?: string;
}

export interface MaskedJwtPayload extends Omit<JwtPayload, "permissions"> {
   permissions: number;
}
