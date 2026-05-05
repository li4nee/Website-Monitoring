import { z } from "zod";
import { DEVELOPMENT_ENVIRONMENT } from "../../../shared/typings/auth.typings";

export const CreateApiKeyDTO = z.object({
   name: z.string().min(1).max(255),
   description: z.string().optional(),

   environment: z.nativeEnum(DEVELOPMENT_ENVIRONMENT).default(DEVELOPMENT_ENVIRONMENT.DEVELOPMENT),

   permissions: z.object({
      writeAccess: z.boolean().default(false),
      readAccess: z.boolean().default(true),
   }),

   security: z.object({
      allowedIPsIPV4: z
         .array(
            z
               .string()
               .regex(
                  /^(localhost|127\.0\.0\.1|(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?))$/,
               ),
         )
         .default([]),

      allowedIPsIPV6: z.array(z.string().regex(/^(localhost|::1|(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4})$/)).default([]),

      allowedOrigins: z
         .array(
            z.string().regex(/^(localhost|http:\/\/localhost(:\d+)?|(https?:\/\/)?([\w-]+(\.[\w-]+)+)(\/[\w-]*)*(\?.*)?(#.*)?)$/),
         )
         .default([]),
   }),

   metaData: z
      .object({
         purpose: z.string().max(200).optional(),
         tags: z.array(z.string().max(50)).default([]),
      })
      .optional(),

   rotationWarningPeriod: z.number().default(30),

   expiresAt: z.coerce.date().default(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)),
});

export type CreateApiKeyDtoType = z.infer<typeof CreateApiKeyDTO>;
