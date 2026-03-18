import type { Request, Response } from "express";

import {
  createChatBodySchema,
  createRollBodySchema
} from "../../../shared/contracts/campaigns.js";
import type { ChatMessage } from "../../../shared/types.js";
import { parseWithSchema, requireRouteParam } from "../http/validation.js";
import { broadcastCampaignToRoom } from "../realtime/roomGateway.js";
import { mutateDatabase } from "../store.js";
import { createId, now, requireUser } from "../services/authService.js";
import { requireCampaignMember, trimChat } from "../services/campaignDomain.js";
import { rollDice } from "../dice.js";

export const chatController = {
  async createMessage(request: Request, response: Response) {
    const user = requireUser(request);
    const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
    const body = parseWithSchema(createChatBodySchema, request.body);

    const message = await mutateDatabase((database) => {
      const { campaign } = requireCampaignMember(database, campaignId, user.id);
      const text = body.text.slice(0, 500);

      if (/^\/roll\s+/i.test(text)) {
        const roll = rollDice(text, `${user.name} rolled`);
        const message: ChatMessage = {
          id: createId("msg"),
          campaignId,
          userId: user.id,
          userName: user.name,
          text: `${roll.label}: ${roll.notation}`,
          createdAt: now(),
          kind: "roll",
          roll
        };

        campaign.chat.push(message);
        trimChat(campaign);
        return message;
      }

      const message: ChatMessage = {
        id: createId("msg"),
        campaignId,
        userId: user.id,
        userName: user.name,
        text,
        createdAt: now(),
        kind: "message"
      };

      campaign.chat.push(message);
      trimChat(campaign);
      return message;
    });

    await broadcastCampaignToRoom(campaignId);
    response.status(201).json(message);
  },

  async createRoll(request: Request, response: Response) {
    const user = requireUser(request);
    const campaignId = requireRouteParam(request.params.campaignId, "campaignId");
    const body = parseWithSchema(createRollBodySchema, request.body);

    const message = await mutateDatabase((database) => {
      const { campaign } = requireCampaignMember(database, campaignId, user.id);
      const roll = rollDice(body.notation, body.label ?? `${user.name} rolled`);
      const message: ChatMessage = {
        id: createId("msg"),
        campaignId,
        userId: user.id,
        userName: user.name,
        text: `${roll.label}: ${roll.notation}`,
        createdAt: now(),
        kind: "roll",
        roll
      };

      campaign.chat.push(message);
      trimChat(campaign);
      return message;
    });

    await broadcastCampaignToRoom(campaignId);
    response.status(201).json(message);
  }
};
