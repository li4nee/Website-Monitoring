import { z } from "zod";
import { mongoObjectId } from "../../../shared/middleware/zodValidators.middleware";

export const clientIdParamSchema = z.object({ clientId: mongoObjectId });
export const clientAndKeyParamSchema = z.object({ clientId: mongoObjectId, id: mongoObjectId });
