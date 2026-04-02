import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../typings/error.typings";
import { JwtUtils } from "../utils/jwt.utils";
import { AuthorizedRequest } from "../typings/base.typings";
import logger from "../config/logger.config";
import { globalConfig } from "../config/global.config";

export function authenticate(req: AuthorizedRequest, res: Response, next: NextFunction) {
      let token = null;
      if (!req.cookies || !req.cookies["authToken"]) throw new UnauthorizedError("Authentication token is missing");
      token = req.cookies["authToken"];

      try {
        const decoded = JwtUtils.decodeToken(token,globalConfig.jwt.secret);
        if (!decoded || typeof decoded === "string") throw new UnauthorizedError("Invalid authentication token");
        req.user = decoded;
        next();
      } catch (error) {
        logger.error("Authentication error:", error);
        throw new UnauthorizedError("Failed to authenticate token");
      }
}
