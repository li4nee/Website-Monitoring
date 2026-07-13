import type { Response, NextFunction } from "express";
import logger from "../config/logger.config";
import { PermissionNotGranted, UnauthorizedError } from "../typings/error.typings";
import ClientDependeniesContainer from "../../modules/client/dependencies/client.dependency";
import { ClientAuthorizedRequest } from "../typings/auth.typings";

const { apiKeyService } = ClientDependeniesContainer.init().services;

/**
 * Middleware to validate API key from the request header.
 * Backed by ApiKeyCache (Redis, short TTL) — see apiKey.service.ts's
 * getClientFromApiKey — since this runs on every single /ingest request.
 */
const validateApiKey = async (req: ClientAuthorizedRequest, _res: Response, next: NextFunction) => {
   try {
      const apiKey = req.header("x-api-key");
      if (!apiKey) {
         logger.warn("[ValidateApiKey] API key is missing in the request header", {
            endpoint: req.originalUrl,
            method: req.method,
            ip: req.ip,
         });
         throw new UnauthorizedError("API key is missing in the request header");
      }

      const result = await apiKeyService.getClientFromApiKey(apiKey);

      const client = result?.client;
      const apiKeyDoc = result?.apiKey;

      if (!apiKeyDoc) {
         logger.warn("[ValidateApiKey] Invalid API key provided", {
            endpoint: req.originalUrl,
            method: req.method,
            ip: req.ip,
         });
         throw new PermissionNotGranted("Invalid API key");
      }

      if (!client) {
         logger.warn("[ValidateApiKey] Invalid API key provided", {
            endpoint: req.originalUrl,
            method: req.method,
            ip: req.ip,
         });
         throw new PermissionNotGranted("Invalid API key");
      }

      if (!client.isActive) {
         logger.warn("[ValidateApiKey] API key belongs to an inactive client", {
            endpoint: req.originalUrl,
            method: req.method,
            ip: req.ip,
            clientSlug: client.slug,
         });
         throw new PermissionNotGranted("API key belongs to an inactive client");
      }

      if (!apiKeyDoc.permissions.writeAccess) {
         logger.warn("[ValidateApiKey] API key does not have write access", {
            endpoint: req.originalUrl,
            method: req.method,
            ip: req.ip,
            clientSlug: client.slug,
         });
         throw new PermissionNotGranted("API key does not have write access");
      }

      req.client = {
         id: client.id,
         name: client.name,
         slug: client.slug,
         ip: req.ip,
         userAgent: req.get("User-Agent") || undefined,
      };

      req.apiKey = {
         id: apiKeyDoc.id,
         apiKeyId: apiKeyDoc.keyId,
         name: apiKeyDoc.name,
         permissions: {
            writeAccess: apiKeyDoc.permissions.writeAccess,
            readAccess: apiKeyDoc.permissions.readAccess,
         },
      };

      next();
   } catch (error) {
      logger.error("[ValidateApiKey] Error validating API key", {
         error,
      });
      next(error);
   }
};

export default validateApiKey;
