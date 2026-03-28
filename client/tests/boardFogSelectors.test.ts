import { describe, expect, it } from "vitest";
import type {
  ActorSheet,
  BoardToken,
  Campaign,
  CampaignMap,
  CampaignSnapshot
} from "@shared/types";

import { createClientActorDraft, createClientMapDraft } from "../src/lib/drafts.ts";
import {
  selectBoardSeenCells,
  selectBoardVisibleCells,
  selectVisibleMapTokens
} from "../src/features/campaign/selectors.ts";

function createBoardMap(): CampaignMap {
  const map = createClientMapDraft("Fog Test");
  map.id = "map-fog";
  map.width = 150;
  map.height = 150;
  map.grid.cellSize = 50;
  map.grid.offsetX = 0;
  map.grid.offsetY = 0;
  map.fogEnabled = true;
  return map;
}

function createActor(id: string, ownerId: string, visionRange = 1): ActorSheet {
  const actor = createClientActorDraft("character", ownerId);
  actor.id = id;
  actor.ownerId = ownerId;
  actor.visionRange = visionRange;
  actor.name = `Actor ${id}`;
  return actor;
}

function createToken(id: string, actorId: string, mapId: string, x: number, y: number): BoardToken {
  return {
    id,
    actorId,
    actorKind: "character",
    mapId,
    x,
    y,
    size: 1,
    widthSquares: 1,
    heightSquares: 1,
    rotationDegrees: 0,
    color: "#8cae75",
    label: `Token ${id}`,
    imageUrl: "",
    visible: true,
    statusMarkers: []
  };
}

function createCampaignFixture() {
  const map = createBoardMap();
  const hero = createActor("actor-hero", "user-1", 1);
  const scout = createActor("actor-scout", "user-2", 2);
  const heroToken = createToken("token-hero", hero.id, map.id, 75, 75);
  const seenOnlyToken = createToken("token-seen", scout.id, map.id, 25, 25);
  const hiddenToken = createToken("token-hidden", scout.id, map.id, 125, 125);

  const campaign: Campaign = {
    id: "campaign-1",
    name: "Board Campaign",
    createdAt: "2026-03-28T00:00:00.000Z",
    createdBy: "user-1",
    activeMapId: map.id,
    allowedSourceBooks: [],
    members: [],
    invites: [],
    actors: [hero, scout],
    maps: [map],
    mapAssignments: [],
    tokens: [heroToken, seenOnlyToken, hiddenToken],
    chat: [],
    exploration: {
      "user-1": {
        [map.id]: ["0:0", "1:1"]
      }
    }
  };

  const snapshot: CampaignSnapshot = {
    campaign,
    currentUser: {
      id: "user-1",
      name: "Player One",
      email: "player@example.com",
      isAdmin: false
    },
    role: "player",
    catalog: [],
    compendium: {
      spells: [],
      feats: [],
      classes: []
    },
    playerVision: {
      [map.id]: ["0:0", "1:1"]
    }
  };

  return { map, campaign, snapshot, heroToken, seenOnlyToken, hiddenToken };
}

describe("campaign board fog selectors", () => {
  it("returns explored cells for players and previewed fog for DMs", () => {
    const { map, campaign, snapshot } = createCampaignFixture();

    expect(
      selectBoardSeenCells({
        activeMap: map,
        role: "player",
        campaign,
        snapshot
      })
    ).toEqual(["0:0", "1:1"]);

    expect(
      selectBoardSeenCells({
        activeMap: map,
        role: "dm",
        fogPreviewUserId: "user-1",
        campaign,
        snapshot
      })
    ).toEqual(["0:0", "1:1"]);
  });

  it("reveals the whole board when fog is disabled", () => {
    const { map, campaign, snapshot } = createCampaignFixture();
    map.fogEnabled = false;

    expect(
      selectBoardSeenCells({
        activeMap: map,
        role: "player",
        campaign,
        snapshot
      })
    ).toHaveLength(9);

    expect(
      selectBoardVisibleCells({
        activeMap: map,
        campaign,
        activeMapTokens: campaign.tokens,
        userId: "user-1",
        role: "player"
      })
    ).toEqual(new Set(["0:0", "1:0", "2:0", "0:1", "1:1", "2:1", "0:2", "1:2", "2:2"]));
  });

  it("computes visible cells from the current player's controlled token and DM previews", () => {
    const { map, campaign } = createCampaignFixture();

    const playerVisible = selectBoardVisibleCells({
      activeMap: map,
      campaign,
      activeMapTokens: campaign.tokens,
      userId: "user-1",
      role: "player"
    });

    expect(playerVisible).toEqual(new Set(["1:1", "0:1", "2:1", "1:0", "1:2"]));

    const dmPreviewVisible = selectBoardVisibleCells({
      activeMap: map,
      campaign,
      activeMapTokens: campaign.tokens,
      userId: "dm-1",
      role: "dm",
      fogPreviewUserId: "user-1"
    });

    expect(dmPreviewVisible).toEqual(playerVisible);
  });

  it("shows tokens to players when they are currently visible or remembered", () => {
    const { map, campaign, heroToken, seenOnlyToken, hiddenToken } = createCampaignFixture();

    const visibleTokens = selectVisibleMapTokens({
      activeMap: map,
      role: "player",
      activeMapTokens: campaign.tokens,
      visibleCells: new Set(["1:1"]),
      seenCells: new Set(["0:0"])
    });

    expect(visibleTokens).toEqual([heroToken, seenOnlyToken]);
    expect(visibleTokens).not.toContain(hiddenToken);
  });

  it("lets DMs see all tokens even when fog is enabled", () => {
    const { map, campaign } = createCampaignFixture();

    expect(
      selectVisibleMapTokens({
        activeMap: map,
        role: "dm",
        activeMapTokens: campaign.tokens,
        visibleCells: new Set(),
        seenCells: new Set()
      })
    ).toEqual(campaign.tokens);
  });
});
