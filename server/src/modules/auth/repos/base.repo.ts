/**
 * Makes this easy to switch between database without touching the service layer.
 * Postgres , mongodb , you can use anything you want.
 * Just implement the methods in the base repo
 */
export abstract class UserBaseRepo<T> {
   protected model: any;

   constructor(model: any) {
      this.model = model;
   }

   abstract create(data: Partial<T>): Promise<T>;
   abstract findByEmail(email: string): Promise<T | null>;
   abstract findByUsername(username: string): Promise<T | null>;
   abstract findById(id: string): Promise<T | null>;
   abstract update(id: string, data: Partial<T>): Promise<T | null>;
   abstract delete(id: string): Promise<void>;
   abstract findIfAnyExists(isSuperAdmin?: boolean, email?: string): Promise<boolean>;
   abstract findIfAnyExistsAndReturnsCount(filter: Partial<T>): Promise<number>;
}
