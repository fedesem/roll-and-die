import { useCallback, useEffect, useState, type FormEvent } from "react";

import { loginBodySchema, registerBodySchema } from "@shared/contracts/auth";
import type { AuthPayload } from "@shared/types";

import type { AppRoute } from "../../appRouteState";
import { usePersistentState } from "../../hooks/usePersistentState";
import { toAuthErrorMessage } from "./authErrors";
import { fetchCurrentUser, login, register } from "./authService";
import type { AuthFormState, AuthMode } from "./types";

const sessionStorageKey = "dnd-board-session";

interface UseAuthSessionOptions {
  route: AppRoute;
  setJoinCode: (value: string) => void;
  onBanner: (tone: "info" | "error", text: string) => void;
}

function toZodMessage(error: unknown) {
  if (!(error instanceof Error) || !("issues" in error)) {
    return null;
  }

  const firstIssue = (error as { issues?: Array<{ message?: string }> }).issues?.[0];
  return typeof firstIssue?.message === "string" ? firstIssue.message : null;
}

export function useAuthSession({ route, setJoinCode, onBanner }: UseAuthSessionOptions) {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authForm, setAuthForm] = useState<AuthFormState>({
    name: "",
    email: "",
    password: ""
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [session, setSession] = usePersistentState<AuthPayload | null>(sessionStorageKey, null);

  useEffect(() => {
    if (!session?.token) {
      return;
    }

    void fetchCurrentUser(session.token)
      .then((user) => {
        setSession((current) =>
          current && current.token === session.token
            ? {
                ...current,
                user
              }
            : current
        );
      })
      .catch(() => undefined);
  }, [session?.token, setSession]);

  const handleAuthFormChange = useCallback((field: keyof AuthFormState, value: string) => {
    setAuthError(null);
    setAuthForm((current) => ({
      ...current,
      [field]: value
    }));
  }, []);

  const handleAuthModeChange = useCallback((mode: AuthMode) => {
    setAuthError(null);
    setAuthMode(mode);
  }, []);

  const handleAuthSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      try {
        if (authMode === "login") {
          loginBodySchema.parse(authForm);
        } else {
          registerBodySchema.parse(authForm);
        }

        const payload = await (authMode === "login" ? login(authForm) : register(authForm));

        setSession(payload);
        setAuthError(null);
        onBanner("info", authMode === "login" ? "Signed in." : "Account created.");
        setAuthForm({
          name: "",
          email: "",
          password: ""
        });

        if (route.name === "campaignJoin" && route.code) {
          setJoinCode(route.code);
        }
      } catch (error) {
        const message = toZodMessage(error) ?? toAuthErrorMessage(authMode, error);
        setAuthError(message);
        onBanner("error", message);
      }
    },
    [authForm, authMode, onBanner, route, setJoinCode, setSession]
  );

  return {
    authMode,
    authForm,
    authError,
    session,
    setSession,
    handleAuthFormChange,
    handleAuthModeChange,
    handleAuthSubmit
  };
}
