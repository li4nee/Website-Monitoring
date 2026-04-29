import { NextFunction } from "express";
import type { Response } from "express";
import { ClientAuthorizedRequest } from "../../../shared/typings/base.typings";
import { IIngestService } from "../contracts/IIngestService.contract";
import logger from "../../../shared/config/logger.config";
import { UnauthorizedError } from "../../../shared/typings/error.typings";
import { ResponseFormatter } from "../../../shared/utils/responseFormatter.utils";

export class IngestController {
   private ingestService: IIngestService;
   constructor(ingestService: IIngestService) {
      this.ingestService = ingestService;
   }

   async ingestApiHits(req: ClientAuthorizedRequest, res: Response, next: NextFunction) {
      try {
         const clientId = req.client?.id;
         const apiKeyId = req.apiKey?.id;

         if (!clientId || !apiKeyId) {
            logger.warn("[IngestController] Missing clientId or apiKeyId in request", {
               clientId,
               apiKeyId,
            });
            throw new UnauthorizedError("Missing clientId or apiKeyId in request");
         }

         logger.info("[IngestController] Received API hit data", {
            body: req.body,
            clientId,
            apiKeyId,
         });

         let result = await this.ingestService.ingestApiHit(req.body, clientId, apiKeyId);
         res.status(202).json(ResponseFormatter.success("API hit ingested successfully", 202, result));
      } catch (error) {
         next(error);
      }
   }
}
