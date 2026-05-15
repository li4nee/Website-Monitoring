export abstract class AlertFireLogBaseRepo<T> {
   abstract create(data: Record<string, any>): Promise<T>;
   abstract findByAlertId(alertId: string, limit: number, cursor?: string): Promise<{ data: T[]; nextCursor?: string }>;
   abstract findLastFireForAlert(alertId: string): Promise<T | null>;
   abstract deleteByAlertId(alertId: string): Promise<void>;
}
