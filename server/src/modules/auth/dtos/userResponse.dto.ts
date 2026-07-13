import { User, UserWithId } from "../../../shared/infra/db/mongo/models/user.model";
import { Types } from "mongoose";

export class UserResponseDto {
   id: string;
   email: string;
   username?: string;
   role: string;
   clientId?: string;
   isEmailVerified: boolean;

   constructor(user: UserWithId) {
      this.id = user._id.toString();
      this.email = user.email;
      this.username = user.username;
      this.role = user.role;
      this.isEmailVerified = user.isEmailVerified ?? false;
      if (user.clientId) {
         this.clientId = user.clientId.toString();
      }
   }
}
