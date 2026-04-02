import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ResponseFormatter } from "../utils/responseFormatter.utils";

export const validateBody = (schema: z.ZodType<any>) => async (req: Request, res: Response, next: NextFunction) => {
   try {
      req.body = await schema.parseAsync(req.body);
      next();
   } catch (error: any) {
      const formattedErrors = error instanceof z.ZodError ? error.issues.map((e: z.ZodIssue) => ({ path: e.path.join('.'), message: e.message, code: e.code })) : error.errors;
      return res.status(400).json(ResponseFormatter.error("Validation failed", 400, formattedErrors));
   }
};

export const validateQuery = (schema: z.ZodType<any>) => async (req: Request, res: Response, next: NextFunction) => {
   try {
      req.query = await schema.parseAsync(req.query);
      next();
   } catch (error: any) {
      const formattedErrors = error instanceof z.ZodError ? error.issues.map((e: z.ZodIssue) => ({ path: e.path.join('.'), message: e.message, code: e.code })) : error.errors;
      res.status(400).json(ResponseFormatter.error("Query validation failed", 400, formattedErrors));
   }
};

export const validateParams = (schema: z.ZodType<any>) => async (req: Request, res: Response, next: NextFunction) => {
   try {
      req.params = await schema.parseAsync(req.params);
      next();
   } catch (error: any) {
      const formattedErrors = error instanceof z.ZodError ? error.issues.map((e: z.ZodIssue) => ({ path: e.path.join('.'), message: e.message, code: e.code })) : error.errors;
      res.status(400).json(ResponseFormatter.error("Params validation failed", 400, formattedErrors));
   }
};
