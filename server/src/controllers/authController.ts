import type { Request, Response } from "express";

import { loginBodySchema, registerBodySchema } from "../../../shared/contracts/auth.js";
import { mutateDatabase, type StoredUser } from "../store.js";
import { HttpError } from "../http/errors.js";
import { parseWithSchema } from "../http/validation.js";
import {
  createId,
  createPassword,
  createToken,
  hasPasswordCredentials,
  now,
  passwordMatches,
  requireUser,
  toUserProfile
} from "../services/authService.js";

export const authController = {
  async register(request: Request, response: Response) {
    const body = parseWithSchema(registerBodySchema, request.body);
    const name = body.name.trim();
    const email = body.email.toLowerCase();
    const password = body.password;

    if (password.length < 6) {
      throw new HttpError(400, "Password must be at least 6 characters.");
    }

    const payload = await mutateDatabase((database) => {
      if (database.users.some((entry) => entry.email === email)) {
        throw new HttpError(409, "An account already exists for that email.");
      }

      const user: StoredUser = {
        id: createId("usr"),
        name,
        email,
        isAdmin: database.users.length === 0,
        ...createPassword(password)
      };
      const token = createToken();

      database.users.push(user);
      database.sessions.push({
        token,
        userId: user.id,
        createdAt: now()
      });

      return {
        token,
        user: toUserProfile(user)
      };
    });

    response.status(201).json(payload);
  },

  async login(request: Request, response: Response) {
    const body = parseWithSchema(loginBodySchema, request.body);
    const email = body.email.toLowerCase();
    const password = body.password;

    const payload = await mutateDatabase((database) => {
      const user = database.users.find((entry) => entry.email === email);
      const credentialsMatch = user ? passwordMatches(password, user) : false;

      if (user && !hasPasswordCredentials(user)) {
        request.log.warn(
          {
            event: "auth.login.invalid-stored-credentials",
            userId: user.id,
            email
          },
          "auth.login.invalid-stored-credentials"
        );
      }

      if (!user || !credentialsMatch) {
        throw new HttpError(401, "Invalid email or password.");
      }

      const token = createToken();
      database.sessions.push({
        token,
        userId: user.id,
        createdAt: now()
      });

      return {
        token,
        user: toUserProfile(user)
      };
    });

    response.json(payload);
  },

  async me(request: Request, response: Response) {
    response.json(requireUser(request));
  }
};
