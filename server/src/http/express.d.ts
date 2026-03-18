import type { Logger } from "pino";

import type { UserProfile } from "../../../shared/types.js";

declare global {
  namespace Express {
    interface Request {
      log: Logger;
      user?: UserProfile;
    }
  }
}

export {};
