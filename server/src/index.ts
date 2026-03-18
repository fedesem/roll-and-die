import { createServer } from "node:http";

import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";

import { HttpError } from "./http/errors.js";
import { wrap } from "./http/wrap.js";
import { logger, requestLogger } from "./logger.js";
import { createRoomGateway } from "./realtime/roomGateway.js";
import { createAdminRouter } from "./routes/adminRoutes.js";
import { createAuthRouter } from "./routes/authRoutes.js";
import { createCampaignRouter, createInviteRouter } from "./routes/campaignRoutes.js";
import { createChatRouter } from "./routes/chatRoutes.js";
import { createMapRouter } from "./routes/mapRoutes.js";
import { createTokenRouter } from "./routes/tokenRoutes.js";
import { createAuthMiddleware } from "./services/authService.js";

const app = express();
const httpServer = createServer(app);
const port = Number(process.env.PORT || 4000);

createRoomGateway(httpServer);

app.use(
  cors({
    origin: true,
    credentials: true
  })
);
app.use(requestLogger);
app.use(express.json({ limit: "20mb" }));
app.use(wrap(createAuthMiddleware()));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.use("/api/auth", createAuthRouter());
app.use("/api/admin", createAdminRouter());
app.use("/api/invites", createInviteRouter());
app.use("/api/campaigns", createCampaignRouter());
app.use("/api/campaigns/:campaignId/maps", createMapRouter());
app.use("/api/campaigns/:campaignId/tokens", createTokenRouter());
app.use("/api/campaigns", createChatRouter());

app.use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof HttpError) {
    request.log.warn(
      {
        err: error,
        statusCode: error.statusCode
      },
      "handled request error"
    );
    response.status(error.statusCode).json({ error: error.message });
    return;
  }

  if (error instanceof Error) {
    request.log.error({ err: error }, "unhandled request error");
    response.status(500).json({ error: error.message });
    return;
  }

  request.log.error({ err: error }, "unknown request error");
  response.status(500).json({ error: "Unknown server error." });
});

httpServer.listen(port, () => {
  logger.info({ port }, "DnD board API listening");
});
