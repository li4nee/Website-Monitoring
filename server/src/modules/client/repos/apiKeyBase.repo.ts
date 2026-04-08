export abstract class ApiKeyBaseRepo<T> {
   abstract create(data: Partial<T>): Promise<T>;
   abstract delete(id: string): Promise<void>;
   abstract findByKeyValue(keyValue: string, isActive: boolean, checkExpiry: boolean): Promise<T | null>;
   abstract findByClientId(clientId: string, isActive: boolean, checkExpiry: boolean): Promise<T[]>;
   abstract findAll(_filter?: any, _options?: any): Promise<{ data: T[]; nextCursor?: string }>;
}
