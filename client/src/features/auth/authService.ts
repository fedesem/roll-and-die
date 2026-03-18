import type { AuthPayload } from "@shared/types";

import { apiRequest } from "../../api";

export interface AuthFormInput {
  name: string;
  email: string;
  password: string;
}

export function login(input: AuthFormInput) {
  return apiRequest<AuthPayload>("/auth/login", {
    method: "POST",
    body: input
  });
}

export function register(input: AuthFormInput) {
  return apiRequest<AuthPayload>("/auth/register", {
    method: "POST",
    body: input
  });
}

export function fetchCurrentUser(token: string) {
  return apiRequest<AuthPayload["user"]>("/auth/me", { token });
}
