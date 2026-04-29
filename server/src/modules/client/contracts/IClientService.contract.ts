import { Client } from "../../../shared/models/client.model";
import { User } from "../../../shared/models/user.model";
import { UserInsideAuthorizedRequest } from "../../../shared/typings/base.typings";
import { CreateClientDTOType } from "../dtos/createClient.dto";
import { CreateClientUserDTOType } from "../dtos/createClientUser.dto";

export interface IClientService {
    createClient(clientData: CreateClientDTOType, createdBy: string): Promise<Client>;
    createClientUser(
        clientId: string,
        userData: CreateClientUserDTOType,
        createdBy: UserInsideAuthorizedRequest,
    ): Promise<Omit<User, "password" | "trash" | "isActive">>;
}
