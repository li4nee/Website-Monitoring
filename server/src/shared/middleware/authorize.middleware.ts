import { NextFunction, Response } from "express";
import { AuthorizedRequest } from "../typings/base.typings";
import { PermissionNotGranted, UnauthorizedError } from "../typings/error.typings";

export const authorize = (requiredRoles: string[]) => (req: AuthorizedRequest, res: Response, next: NextFunction) => {
    if (!req.user?.role)
        throw new UnauthorizedError("User not authenticated");

    if (requiredRoles.length > 0 && !requiredRoles.includes(req.user.role))
        throw new PermissionNotGranted("User not authorized");

    next();
};