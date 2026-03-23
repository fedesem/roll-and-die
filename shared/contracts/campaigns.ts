import { z } from "zod";

import {
  actorKindSchema,
  actorSheetSchema,
  boardTokenSchema,
  campaignInviteSchema,
  campaignSourceBookSchema,
  campaignMapSchema,
  campaignSnapshotSchema,
  campaignSummarySchema,
  chatMessageSchema,
  drawingStrokeSchema,
  mapPingSchema,
  mapViewportRecallSchema,
  measurePreviewSchema,
  memberRoleSchema,
  monsterTemplateSchema,
  pointSchema,
  tokenStatusMarkerSchema,
  tokenMovementPreviewSchema
} from "./domain.js";

export const emptyResponseSchema = z.null();

export const campaignListResponseSchema = z.array(campaignSummarySchema);
export const createCampaignBodySchema = z.object({
  name: z.string().trim().min(1),
  allowedSourceBooks: z.array(z.string().trim().min(1)).default([])
});
export const campaignSummaryResponseSchema = campaignSummarySchema;
export const campaignSourceBooksResponseSchema = z.array(campaignSourceBookSchema);

export const acceptInviteBodySchema = z.object({
  code: z.string().trim().min(1)
});

export const campaignSnapshotResponseSchema = campaignSnapshotSchema;

export const createInviteBodySchema = z.object({
  label: z.string().trim().min(1),
  role: memberRoleSchema
});
export const campaignInviteResponseSchema = campaignInviteSchema;

export const createActorBodySchema = z.object({
  name: z.string().trim().min(1),
  kind: actorKindSchema
});
export const saveActorBodySchema = actorSheetSchema;
export const actorResponseSchema = actorSheetSchema;

export const createMonsterActorBodySchema = z.object({
  templateId: z.string().trim().min(1)
});
export const monsterTemplateResponseSchema = monsterTemplateSchema;

export const createMapBodySchema = campaignMapSchema;
export const saveMapBodySchema = campaignMapSchema;
export const mapResponseSchema = campaignMapSchema;

export const assignActorToMapBodySchema = z.object({
  actorId: z.string().trim().min(1)
});

export const createTokenBodySchema = z.object({
  actorId: z.string().trim().min(1),
  mapId: z.string().trim().min(1),
  x: z.number().finite(),
  y: z.number().finite()
});

export const updateTokenBodySchema = z.object({
  mapId: z.string().trim().min(1).optional(),
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
  size: z.number().finite().optional(),
  color: z.string().optional(),
  label: z.string().optional(),
  visible: z.boolean().optional(),
  statusMarkers: z.array(tokenStatusMarkerSchema).optional()
});
export const tokenResponseSchema = boardTokenSchema;

export const createChatBodySchema = z.object({
  text: z.string().trim().min(1)
});
export const createRollBodySchema = z.object({
  notation: z.string().trim().min(1),
  label: z.string().trim().min(1).optional(),
  actorId: z.string().trim().min(1).optional()
});
export const chatMessageResponseSchema = chatMessageSchema;

export const drawingUpdateEntrySchema = z.object({
  id: z.string().trim().min(1),
  points: z.array(pointSchema),
  rotation: z.number().finite()
});

export const tokenPreviewResponseSchema = tokenMovementPreviewSchema.nullable();
export const measurePreviewResponseSchema = measurePreviewSchema.nullable();
export const pingResponseSchema = mapPingSchema;
export const viewRecallResponseSchema = mapViewportRecallSchema;
export const drawingResponseSchema = drawingStrokeSchema;
