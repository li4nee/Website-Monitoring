import { ApiHitDataDtoType } from "../dtos/hitData.dto";
import { IngestApiHitResponseDto } from "../dtos/ingestApiHitResponse.dto";

export interface IIngestService {
   ingestApiHit(
      data: ApiHitDataDtoType,
      clientId: string,
      apiKeyId: string,
      ip?: string,
      userAgent?: string,
   ): Promise<IngestApiHitResponseDto>;
}
