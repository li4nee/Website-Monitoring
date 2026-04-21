import logger from "../../../shared/config/logger.config";
import { User, UserModel, UserWithId } from "../../../shared/models/user.model";
import { USER_ROLE } from "../../../shared/typings/base.typings";
import { UserBaseRepo } from "./userBase.repo";

export class MongoUserRepo extends UserBaseRepo<UserWithId> {
   private model = UserModel;

   async create(userData: Partial<User>): Promise<UserWithId> {
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

      const created = await this.model.create(userData);

      logger.info(`[MongoUserRepo] User created with id: ${created._id} and email: ${created.email}`);
      return created.toObject() as UserWithId;
   }

   private async findOneBy(filter: Partial<User>, includeOnlyId = false): Promise<UserWithId | null> {
      const selectFields = includeOnlyId ? "_id" : "-__v";
      const doc = await this.model.findOne(filter).select(selectFields);
      return doc ? (doc.toObject() as UserWithId) : null;
   }

   async findByEmail(email: string, includeOnlyId = false): Promise<UserWithId | null> {
      return this.findOneBy({ email }, includeOnlyId);
   }

   async findByUsername(username: string, includeOnlyId = false): Promise<UserWithId | null> {
      return this.findOneBy({ username }, includeOnlyId);
   }

   async findById(id: string, includeOnlyId = false): Promise<UserWithId | null> {
      const selectFields = includeOnlyId ? "_id" : "-password -__v";
      const doc = await this.model.findById(id).select(selectFields);
      return doc ? (doc.toObject() as UserWithId) : null;
   }

   async update(id: string, userData: Partial<User>): Promise<UserWithId | null> {
      const updated = await this.model.findByIdAndUpdate(id, userData, { new: true });
      return updated ? (updated.toObject() as UserWithId) : null;
   }

   async delete(id: string): Promise<void> {
      await this.model.findByIdAndDelete(id);
      logger.info(`[MongoUserRepo] User deleted: ${id}`);
   }

   async findIfAnyExistsAndReturnsCount(filter: Partial<User>): Promise<number> {
      return this.model.countDocuments(filter);
   }

   async findIfAnyExists(isSuperAdmin: boolean, email: string): Promise<boolean> {
      let doc = null;
      if (isSuperAdmin) doc = await this.model.findOne({}, { _id: 1 });
      if (email) doc = await this.model.findOne({ email }, { _id: 1 });
      return !!doc;
   }

   async findUserRole(id: string): Promise<USER_ROLE | null | undefined> {
      const user = await this.model.findById(id, { role: 1 });
      return user?.role;
   }
}
