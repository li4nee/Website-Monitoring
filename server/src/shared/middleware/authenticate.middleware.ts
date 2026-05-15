import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../typings/error.typings";
import { JwtUtils } from "../utils/jwt.utils";
import { AuthorizedRequest } from "../typings/auth.typings";
import logger from "../config/logger.config";
import { globalConfig } from "../config/global.config";

export function authenticate(req: AuthorizedRequest, res: Response, next: NextFunction) {
   try {
      if (!req.cookies || !req.cookies["authToken"]) {
         logger.warn("[Authenticate] Missing auth token", { url: req.originalUrl });
         return next(new UnauthorizedError("Authentication token is missing"));
      }

      const token = req.cookies["authToken"];
      const decoded = JwtUtils.decodeToken(token, globalConfig.jwt.secret);

      if (!decoded || typeof decoded === "string") {
         logger.warn("[Authenticate] Invalid auth token", { url: req.originalUrl });
         return next(new UnauthorizedError("Invalid authentication token"));
      }

      req.user = decoded;
      next();
   } catch (error) {
      logger.error("[Authenticate] Authentication error:", error);
      next(new UnauthorizedError("Failed to authenticate token"));
   }
}
