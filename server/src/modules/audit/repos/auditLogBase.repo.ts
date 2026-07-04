export abstract class AuditLogBaseRepo<T> {
   abstract findByClientId(clientId: string, limit: number, cursor?: string): Promise<{ data: T[]; nextCursor?: string }>;
}
