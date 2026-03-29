import type { Request, Response } from "express";
import { loginBodySchema, registerBodySchema } from "../../../shared/contracts/auth.js";
import { runStoreTransaction, type StoredUser } from "../store.js";
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
import { countUsers, insertSession, insertUser, readUserByEmail } from "../store/models/users.js";
export const authController = {
  async register(request: Request, response: Response) {
    const body = parseWithSchema(registerBodySchema, request.body);
    const name = body.name.trim();
    const email = body.email.toLowerCase();
    const password = body.password;
    if (password.length < 6) {
      throw new HttpError(400, "Password must be at least 6 characters.");
    }
    const payload = await runStoreTransaction(async (database) => {
      if (await readUserByEmail(database, email)) {
        throw new HttpError(409, "An account already exists for that email.");
      }
      const user: StoredUser = {
        id: createId("usr"),
        name,
        email,
        isAdmin: (await countUsers(database)) === 0,
        ...createPassword(password)
      };
      const token = createToken();
      await insertUser(database, user);
      await insertSession(database, {
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
    const payload = await runStoreTransaction(async (database) => {
      const user = await readUserByEmail(database, email);
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
      await insertSession(database, {
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
