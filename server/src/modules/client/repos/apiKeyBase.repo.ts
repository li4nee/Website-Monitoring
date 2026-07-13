export abstract class ApiKeyBaseRepo<T extends { _id: any }> {
   abstract create(data: Omit<Partial<T>, "_id">): Promise<T>;
   abstract delete(id: string): Promise<void>;
   abstract findByKeyId(keyId: string, isActive: boolean, checkExpiry: boolean): Promise<T | null>;
   abstract findById(id: string, isActive: boolean, checkExpiry: boolean): Promise<T | null>;
   abstract findByKeyValue(keyValue: string, isActive: boolean, checkExpiry: boolean): Promise<T | null>;
   abstract findByClientId(clientId: string, isActive: boolean, checkExpiry: boolean): Promise<T[]>;
   abstract findAll(_filter?: any, _options?: any): Promise<{ data: T[]; nextCursor?: string }>;
   /** Only for cache invalidation — findById() deliberately excludes keyValue everywhere else. */
   abstract findKeyValueById(id: string): Promise<string | null>;
   /** Only for cache invalidation — findByClientId() deliberately excludes keyValue everywhere else. */
   abstract findKeyValuesByClientId(clientId: string, isActive: boolean): Promise<string[]>;
}
