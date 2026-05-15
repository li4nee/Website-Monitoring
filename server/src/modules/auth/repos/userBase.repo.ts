import { USER_ROLE } from "../../../shared/typings/auth.typings";

/**
 * Makes this easy to switch between database without touching the service layer.
 * Postgres , mongodb , you can use anything you want.
 * Just implement the methods in the base repo
 */
export abstract class UserBaseRepo<T extends { _id: any }> {
   abstract create(data: Omit<Partial<T>, "_id">): Promise<T>;
   abstract findByEmail(email: string, includeOnlyId?: boolean): Promise<T | null>;
   abstract findByUsername(username: string, includeOnlyId?: boolean): Promise<T | null>;
   abstract findById(id: string, includeOnlyId?: boolean): Promise<T | null>;
   abstract findByClientId(clientId: string, limit: number, cursor?: string): Promise<{ data: T[]; nextCursor?: string }>;
   abstract update(id: string, data: Partial<T>): Promise<T | null>;
   abstract delete(id: string): Promise<void>;
   abstract findIfAnyExists(isSuperAdmin?: boolean, email?: string): Promise<boolean>;
   abstract findUserRole(id: string): Promise<USER_ROLE | null | undefined>;
   abstract findIfAnyExistsAndReturnsCount(filter: Partial<T>): Promise<number>;
}
