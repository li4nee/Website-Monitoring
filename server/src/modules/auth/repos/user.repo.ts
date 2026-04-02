import { User, UserDocument, UserModel } from "../../../shared/models/user.model";
import { USER_ROLE } from "../../../shared/typings/base.typings";
import { UserBaseRepo } from "./base.repo";
import logger from "../../../shared/config/logger.config";

export class MongoUserRepo extends UserBaseRepo<User> {
   constructor() {
      super(UserModel);
   }

   async create(userData: Partial<User>): Promise<UserDocument> {
      try {
         if (userData.role === USER_ROLE.SUPER_ADMIN) {
            userData.permissions = {
               canCreateApiKeys: true,
               canManageUsers: true,
               canViewRawLogs: true,
               canViewAnalytics: true,
               canManageSettings: true,
               canExportData: true,
            };
         }

         const user = await this.model.create(userData);
         logger.info(`User created: ${user.username}, role: ${user.role}`);
         return user;
      } catch (error) {
         logger.error(`Error creating user: ${error}`);
         throw error;
      }
   }

   async findByEmail(email: string): Promise<UserDocument | null> {
      try {
         const result = await this.model.findOne({ email });
         return result;
      } catch (error) {
         logger.error(`Error finding user by email: ${error}`);
         throw error;
      }
   }

   async findByUsername(username: string): Promise<UserDocument | null> {
      try {
         const result = await this.model.findOne({ username });
         return result;
      } catch (error) {
         logger.error(`Error finding user by username: ${error}`);
         throw error;
      }
   }

   async findById(id: string): Promise<UserDocument | null> {
      try {
         const result = await this.model.findById(id);
         return result;
      } catch (error) {
         logger.error(`Error finding user by id: ${error}`);
         throw error;
      }
   }

   async update(id: string, userData: Partial<User>): Promise<UserDocument | null> {
      try {
         const result = await this.model.findByIdAndUpdate(id, userData, {
            new: true,
         });

         logger.info(`User updated: ${id}`);

         return result;
      } catch (error) {
         logger.error(`Error updating user ${id}: ${error}`);
         throw error;
      }
   }

   async delete(id: string): Promise<void> {
      try {
         await this.model.findByIdAndDelete(id);
         logger.info(`User deleted: ${id}`);
      } catch (error) {
         logger.error(`Error deleting user ${id}: ${error}`);
         throw error;
      }
   }

   async findIfAnyExistsAndReturnsCount(filter: Partial<User>): Promise<number> {
      try {
         const count = await this.model.countDocuments(filter);
         return count;
      } catch (error) {
         logger.error(`Error counting users: ${error}`);
         throw error;
      }
   }

   async findIfAnyExists(isSuperAdmin:boolean,email:string): Promise<boolean> {
      try {
         let doc = null;
         if(isSuperAdmin)
            doc = await this.model.findOne({}, { _id: 1 });
         if(email)
            doc = await this.model.findOne({email},{_id:1});
         return !!doc;
      } catch (error) {
         logger.error(`Error checking if any users exist: ${error}`);
         throw error;
      }
   }
}
