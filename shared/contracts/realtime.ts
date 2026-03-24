import { z } from "zod";

import {
  actorSheetSchema,
  boardTokenSchema,
  campaignSnapshotSchema,
  campaignInviteSchema,
  campaignMapSchema,
  campaignMemberSchema,
  drawingStrokeSchema,
  mapPingSchema,
  mapActorAssignmentSchema,
  mapViewportRecallSchema,
  measurePreviewSchema,
  pointSchema,
  chatMessageSchema,
  tokenMovementPreviewSchema
} from "./domain.js";
import { drawingUpdateEntrySchema } from "./campaigns.js";

export const clientRoomMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("room:join"),
    token: z.string().trim().min(1),
    campaignId: z.string().trim().min(1)
  }),
  z.object({
    type: z.literal("chat:send"),
    text: z.string().trim().min(1)
  }),
  z.object({
    type: z.literal("roll:send"),
    notation: z.string().trim().min(1),
    label: z.string().trim().min(1),
    actorId: z.string().trim().min(1).optional()
  }),
  z.object({
    type: z.literal("token:move"),
    actorId: z.string().trim().min(1),
    x: z.number().finite(),
    y: z.number().finite()
  }),
  z.object({
    type: z.literal("token:preview"),
    actorId: z.string().trim().min(1),
    target: pointSchema.nullable()
  }),
  z.object({
    type: z.literal("measure:preview"),
    preview: measurePreviewSchema.nullable()
  }),
  z.object({
    type: z.literal("drawing:create"),
    mapId: z.string().trim().min(1),
    stroke: drawingStrokeSchema
  }),
  z.object({
    type: z.literal("drawing:update"),
    mapId: z.string().trim().min(1),
    drawings: z.array(drawingUpdateEntrySchema)
  }),
  z.object({
    type: z.literal("drawing:delete"),
    mapId: z.string().trim().min(1),
    drawingIds: z.array(z.string().trim().min(1))
  }),
  z.object({
    type: z.literal("drawing:clear"),
    mapId: z.string().trim().min(1)
  }),
  z.object({
    type: z.literal("map:set-active"),
    mapId: z.string().trim().min(1)
  }),
  z.object({
    type: z.literal("map:ping"),
    mapId: z.string().trim().min(1),
    pingId: z.string().trim().min(1).optional(),
    point: pointSchema
  }),
  z.object({
    type: z.literal("map:ping-recall"),
    mapId: z.string().trim().min(1),
    pingId: z.string().trim().min(1).optional(),
    point: pointSchema,
    center: pointSchema,
    zoom: z.number().finite()
  }),
  z.object({
    type: z.literal("fog:reset"),
    mapId: z.string().trim().min(1)
  }),
  z.object({
    type: z.literal("fog:clear"),
    mapId: z.string().trim().min(1)
  }),
  z.object({
    type: z.literal("door:toggle"),
    doorId: z.string().trim().min(1)
  })
]);

export const serverRoomMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("room:snapshot"),
    snapshot: campaignSnapshotSchema
  }),
  z.object({
    type: z.literal("room:campaign-patch"),
    patch: z.object({
      activeMapId: z.string().trim().min(1).optional(),
      members: z.array(campaignMemberSchema).optional(),
      invites: z.array(campaignInviteSchema).optional(),
      actorsUpsert: z.array(actorSheetSchema).optional(),
      actorIdsRemoved: z.array(z.string().trim().min(1)).optional(),
      mapsUpsert: z.array(campaignMapSchema).optional(),
      mapIdsRemoved: z.array(z.string().trim().min(1)).optional(),
      mapAssignmentsUpsert: z.array(mapActorAssignmentSchema).optional(),
      mapAssignmentsRemoved: z
        .array(
          z.object({
            mapId: z.string().trim().min(1),
            actorId: z.string().trim().min(1)
          })
        )
        .optional(),
      tokensUpsert: z.array(boardTokenSchema).optional(),
      tokenIdsRemoved: z.array(z.string().trim().min(1)).optional(),
      chatAppended: z.array(chatMessageSchema).optional(),
      playerVision: z
        .object({
          mapId: z.string().trim().min(1),
          cells: z.array(z.string().trim().min(1))
        })
        .optional()
    })
  }),
  z.object({
    type: z.literal("room:token-moved"),
    update: z.object({
      token: boardTokenSchema,
      playerVision: z.object({
        mapId: z.string().trim().min(1),
        cells: z.array(z.string().trim().min(1))
      })
    })
  }),
  z.object({
    type: z.literal("room:door-toggled"),
    update: z.object({
      mapId: z.string().trim().min(1),
      doorId: z.string().trim().min(1),
      isOpen: z.boolean(),
      playerVision: z.object({
        mapId: z.string().trim().min(1),
        cells: z.array(z.string().trim().min(1))
      })
    })
  }),
  z.object({
    type: z.literal("room:token-preview"),
    actorId: z.string().trim().min(1),
    mapId: z.string().trim().min(1),
    preview: tokenMovementPreviewSchema.nullable()
  }),
  z.object({
    type: z.literal("room:measure-preview"),
    userId: z.string().trim().min(1),
    mapId: z.string().trim().min(1),
    preview: measurePreviewSchema.nullable()
  }),
  z.object({
    type: z.literal("room:ping"),
    ping: mapPingSchema
  }),
  z.object({
    type: z.literal("room:view-recall"),
    recall: mapViewportRecallSchema
  }),
  z.object({
    type: z.literal("room:error"),
    message: z.string().trim().min(1)
  }),
  z.object({
    type: z.literal("room:joined"),
    campaignId: z.string().trim().min(1)
  })
]);

export type ClientRoomMessageDto = z.infer<typeof clientRoomMessageSchema>;
export type ServerRoomMessageDto = z.infer<typeof serverRoomMessageSchema>;
