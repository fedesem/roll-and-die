import type { Request, Response } from "express";

import {
  createChatBodySchema,
  createRollBodySchema
} from "../../../shared/contracts/campaigns.js";
import { parseWithSchema, requireRouteParam } from "../http/validation.js";
import { broadcastChatAppendedToRoom } from "../realtime/roomGateway.js";
import { requireUser } from "../services/authService.js";
import {
  appendChatMessageCommand,
  appendRollMessageCommand
} from "../services/campaignCommandService.js";

export const chatController = {
  async createMessage(request: Request, response: Response) {
    const user = requireUser(request);
    const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
    const body = parseWithSchema(createChatBodySchema, request.body);

    const message = await appendChatMessageCommand({
      campaignId,
      user,
      text: body.text
    });

    broadcastChatAppendedToRoom(campaignId, message);
    response.status(201).json(message);
  },

  async createRoll(request: Request, response: Response) {
    const user = requireUser(request);
    const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
    const body = parseWithSchema(createRollBodySchema, request.body);

    const message = await appendRollMessageCommand({
      campaignId,
      user,
      notation: body.notation,
      label: body.label ?? `${user.name} rolled`,
      actorId: body.actorId ?? undefined
    });

    broadcastChatAppendedToRoom(campaignId, message);
    response.status(201).json(message);
  }
};
