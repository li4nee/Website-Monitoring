export abstract class ClientBaseRepo<T> {
   protected model: any;

   constructor(model: any) {
      this.model = model;
   }

   abstract create(data: Partial<T>): Promise<T>;
   abstract update(id: string, data: Partial<T>): Promise<T | null>;
   abstract delete(id: string): Promise<void>;
   abstract findById(id: string): Promise<T | null>;
   abstract findAll(_filter?: any, _options?: any): Promise<{ data: T[]; nextCursor?: string }>;
}
