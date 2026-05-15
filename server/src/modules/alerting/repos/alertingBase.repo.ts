export abstract class AlertingBaseRepo<T> {
   abstract create(data: Record<string, any>): Promise<T>;
   abstract findById(id: string): Promise<T | null>;
   abstract findByClientId(clientId: string, limit: number, cursor?: string): Promise<{ data: T[]; nextCursor?: string }>;
   abstract findEnabled(limit: number, cursor?: string): Promise<{ data: T[]; nextCursor?: string }>;
   abstract update(id: string, data: Record<string, any>): Promise<T | null>;
   abstract delete(id: string): Promise<void>;
   abstract setEnabled(id: string, isEnabled: boolean): Promise<T | null>;
}
