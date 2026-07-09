import { Client } from "../../../shared/infra/db/mongo/models/client.model";
import { User, UserWithId } from "../../../shared/infra/db/mongo/models/user.model";
import { UserInsideAuthorizedRequest } from "../../../shared/typings/auth.typings";
import { CreateClientDTOType } from "../dtos/createClient.dto";
import { CreateClientUserDTOType } from "../dtos/createClientUser.dto";
import { UpdateClientDTOType } from "../dtos/updateClient.dto";
import { UpdateUserPermissionsDTOType } from "../dtos/updateUser.dto";

export interface IClientService {
   createClient(clientData: CreateClientDTOType, createdBy: string): Promise<Client>;
   getClient(clientId: string, requestedBy: UserInsideAuthorizedRequest): Promise<Client>;
   listClients(
      requestedBy: UserInsideAuthorizedRequest,
      limit: number,
      cursor?: string,
   ): Promise<{ data: Client[]; nextCursor?: string }>;
   updateClient(clientId: string, data: UpdateClientDTOType, requestedBy: UserInsideAuthorizedRequest): Promise<Client>;
   createClientUser(
      clientId: string,
      userData: CreateClientUserDTOType,
      createdBy: UserInsideAuthorizedRequest,
   ): Promise<Omit<User, "password" | "trash" | "isActive">>;
   listUsersForClient(
      clientId: string,
      requestedBy: UserInsideAuthorizedRequest,
      limit: number,
      cursor?: string,
   ): Promise<{ data: Omit<UserWithId, "password">[]; nextCursor?: string }>;
   updateUserPermissions(
      clientId: string,
      userId: string,
      permissions: UpdateUserPermissionsDTOType,
      requestedBy: UserInsideAuthorizedRequest,
   ): Promise<Omit<User, "password" | "trash" | "isActive">>;
   setUserActive(
      clientId: string,
      userId: string,
      isActive: boolean,
      requestedBy: UserInsideAuthorizedRequest,
   ): Promise<Omit<User, "password" | "trash" | "isActive">>;
   setClientActive(clientId: string, isActive: boolean, requestedBy: UserInsideAuthorizedRequest): Promise<Client>;
}
