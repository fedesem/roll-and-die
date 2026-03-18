import type { Request, Response } from "express";

import { mutateDatabase, type StoredUser } from "../store.js";
import { HttpError } from "../http/errors.js";
import {
  createId,
  createPassword,
  createToken,
  hashPassword,
  now,
  requireUser,
  toUserProfile
} from "../services/authService.js";

function getRequiredString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `${label} is required.`);
  }

  return value.trim();
}

export const authController = {
  async register(request: Request, response: Response) {
    const name = getRequiredString(request.body?.name, "Name");
    const email = getRequiredString(request.body?.email, "Email").toLowerCase();
    const password = getRequiredString(request.body?.password, "Password");

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
    const email = getRequiredString(request.body?.email, "Email").toLowerCase();
    const password = getRequiredString(request.body?.password, "Password");

    const payload = await mutateDatabase((database) => {
      const user = database.users.find((entry) => entry.email === email);

      if (!user || user.passwordHash !== hashPassword(password, user.salt)) {
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
