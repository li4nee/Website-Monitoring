import type { CookieOptions, Response } from "express";
import { globalConfig } from "../config/global.config";

export class CookieUtils {
   static setCookie(res: Response, name: string, value: string, options: Record<string, any> = {}) {
      const defaultOptions = {
         httpOnly: globalConfig.cookieOptions.httpOnly,
         secure: globalConfig.cookieOptions.secure,
         sameSite: globalConfig.cookieOptions.sameSite,
         maxAge: globalConfig.cookieOptions.maxAge,
      };
      const cookieOptions: CookieOptions = { ...defaultOptions, ...options };
      res.cookie(name, value, cookieOptions);
   }

   static clearCookie(res: Response, name: string, options: Record<string, any> = {}) {
      const defaultOptions = {
         httpOnly: globalConfig.cookieOptions.httpOnly,
         secure: globalConfig.cookieOptions.secure,
         sameSite: globalConfig.cookieOptions.sameSite,
      };
      const cookieOptions: CookieOptions = { ...defaultOptions, ...options };
      res.clearCookie(name, cookieOptions);
   }
}
