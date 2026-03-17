import { Router } from "express";

import { authController } from "../controllers/authController.js";
import { wrap } from "../http/wrap.js";

export function createAuthRouter() {
  const router = Router();

  router.post("/register", wrap(authController.register));
  router.post("/login", wrap(authController.login));
  router.get("/me", wrap(authController.me));

  return router;
}
