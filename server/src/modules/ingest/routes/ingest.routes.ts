import express, { NextFunction } from "express";
import validateApiKey from "../../../shared/middleware/validateApiKey.middleware";
import { HitDataDto } from "../dtos/hitData.dto";
import { rateLimiter } from "../../../shared/infra/resilience/rateLimit.infra";
import { validateBody } from "../../../shared/middleware/zodValidators.middleware";
import type { Request, Response } from "express";
import IngestDependencyContainer from "../dependencies/ingestDependencyContainer";
const router = express.Router();
const { ingestController } = IngestDependencyContainer.init().controllers;

/**
 * @route POST /ingest
 * @desc Ingest API hits data
 * @access Public (but requires API key)
 */
router.post("/", rateLimiter, validateApiKey, validateBody(HitDataDto), (request: Request, res: Response, next: NextFunction) =>
   ingestController.ingestApiHits(request, res, next),
);

export default router;
