import type { AuthMode } from "../../pages/AuthPage";

import { toErrorMessage } from "../../lib/errors";

export function toAuthErrorMessage(authMode: AuthMode, error: unknown) {
  const message = toErrorMessage(error);

  if (message === "Invalid email or password.") {
    return "We couldn't sign you in with that email and password. Check both fields and try again.";
  }

  if (message.includes("Failed to fetch")) {
    return "We couldn't reach the server. Make sure the app is running and try again.";
  }

  if (authMode === "register" && message === "An account already exists for that email.") {
    return "That email is already registered. Try logging in instead.";
  }

  if (authMode === "register" && message === "Password must be at least 6 characters.") {
    return "Choose a password with at least 6 characters.";
  }

  return message;
}
