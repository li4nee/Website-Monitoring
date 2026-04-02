import { NextFunction, Request, Response } from "express";
import { requestLogger } from "../config/logger.config";

export const CentralizedRequestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    requestLogger.info(`HTTP ${req.method} ${req.originalUrl}`, {
      method: req.method,
      path: req.originalUrl,
      ip: req.ip || req.socket.remoteAddress,
      status: res.statusCode,
      duration: `${duration}ms`,
    });
  });

  next();
};
