import type { AuthPayload } from "@shared/types";
import { authPayloadResponseSchema, currentUserResponseSchema, loginBodySchema, registerBodySchema } from "@shared/contracts/auth";

import { apiRequest } from "../../api";

export interface AuthFormInput {
  name: string;
  email: string;
  password: string;
}

export function login(input: AuthFormInput) {
  return apiRequest<AuthPayload>("/auth/login", {
    method: "POST",
    body: input,
    bodySchema: loginBodySchema,
    responseSchema: authPayloadResponseSchema
  });
}

export function register(input: AuthFormInput) {
  return apiRequest<AuthPayload>("/auth/register", {
    method: "POST",
    body: input,
    bodySchema: registerBodySchema,
    responseSchema: authPayloadResponseSchema
  });
}

export function fetchCurrentUser(token: string) {
  return apiRequest<AuthPayload["user"]>("/auth/me", {
    token,
    responseSchema: currentUserResponseSchema
  });
}
