import { z } from "zod";

import { authPayloadSchema, userProfileSchema } from "./domain.js";

const authBaseSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().min(1),
  password: z.string().min(1)
});

export const registerBodySchema = authBaseSchema;
export const loginBodySchema = authBaseSchema.pick({
  email: true,
  password: true
});
export const authPayloadResponseSchema = authPayloadSchema;
export const currentUserResponseSchema = userProfileSchema;

export type RegisterBodyDto = z.infer<typeof registerBodySchema>;
export type LoginBodyDto = z.infer<typeof loginBodySchema>;
