import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ActorSheet, CampaignMap, ChatMessage } from "@shared/types";

import { CampaignRouteProvider } from "../src/app/CampaignRouteContext";
import type { CampaignRouteContextValue } from "../src/app/routeContentTypes";
import { CampaignBoardRouteContent } from "../src/app/routes/CampaignBoardRouteContent";
import type { CampaignPageProps } from "../src/pages/CampaignPage";

vi.mock("../src/components/BoardCanvas", () => ({
  BoardCanvas: () => <div>Board Canvas Stub</div>
}));

vi.mock("../src/components/CharacterSheet", () => ({
  CharacterSheet: () => <div>Character Sheet Stub</div>
}));

afterEach(() => {
  cleanup();
});

function createStaticActor(): ActorSheet {
  return {
    id: "actor-1",
    campaignId: "camp-1",
    ownerId: "user-1",
    sheetAccess: "full",
    name: "Pino",
    kind: "static",
    creatureSize: "medium",
    imageUrl: "",
    className: "",
    species: "",
    background: "",
    alignment: "",
    level: 1,
    challengeRating: "",
    experience: 0,
    spellcastingAbility: "int",
    armorClass: 10,
    initiative: 0,
    initiativeRoll: null,
    speed: 30,
    proficiencyBonus: 2,
    inspiration: false,
    visionRange: 0,
    tokenWidthSquares: 1,
    tokenLengthSquares: 1,
    hitPoints: {
      current: 1,
      max: 1,
      temp: 0,
      reducedMax: 0
    },
    hitDice: "",
    abilities: {
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10
    },
    skills: [],
    classes: [],
    savingThrowProficiencies: [],
    toolProficiencies: [],
    languageProficiencies: [],
    spellSlots: [],
    features: [],
    spells: [],
    preparedSpells: [],
    spellState: {
      spellbook: [],
      alwaysPrepared: [],
      atWill: [],
      perShortRest: [],
      perLongRest: []
    },
    talents: [],
    feats: [],
    bonuses: [],
    layout: [],
    attacks: [],
    armorItems: [],
    resources: [],
    inventory: [],
    conditions: [],
    exhaustionLevel: 0,
    concentration: false,
    deathSaves: {
      successes: 0,
      failures: 0,
      history: []
    },
    currency: {
      cp: 0,
      sp: 0,
      ep: 0,
      gp: 0,
      pp: 0
    },
    notes: "",
    color: "#336699"
  };
}

function createMap(): CampaignMap {
  return {
    id: "map-1",
    name: "Main Map",
    backgroundUrl: "",
    backgroundOffsetX: 0,
    backgroundOffsetY: 0,
    backgroundScale: 1,
    width: 1000,
    height: 1000,
    grid: {
      show: true,
      cellSize: 50,
      scale: 5,
      offsetX: 0,
      offsetY: 0,
      color: "#ffffff"
    },
    walls: [],
    teleporters: [],
    drawings: [],
    fogEnabled: false,
    fog: [],
    visibilityVersion: 1
  };
}

function createMessages(): ChatMessage[] {
  return [
    {
      id: "msg-1",
      campaignId: "camp-1",
      userId: "user-1",
      userName: "Fede",
      text: "hello room",
      createdAt: "2026-03-31T10:00:00.000Z",
      kind: "message"
    }
  ];
}

function createBoardPageProps(messages: ChatMessage[]): CampaignPageProps {
  const map = createMap();
  const actor = createStaticActor();
  const noopAsync = async () => undefined;

  return {
    token: "token-user",
    campaign: {
      id: "camp-1",
      name: "Campaign Test",
      createdAt: "2026-03-31T09:00:00.000Z",
      createdBy: "user-1",
      activeMapId: map.id,
      allowedSourceBooks: [],
      members: [
        {
          userId: "user-1",
          name: "Fede",
          email: "fede@example.com",
          role: "dm"
        }
      ],
      invites: [],
      actors: [actor],
      maps: [map],
      mapAssignments: [],
      tokens: [],
      chat: messages,
      exploration: {}
    },
    compendium: {
      spells: [],
      feats: [],
      classes: [],
      variantRules: [],
      conditions: [],
      optionalFeatures: [],
      backgrounds: [],
      items: [],
      languages: [],
      races: [],
      skills: []
    },
    role: "dm",
    currentUserId: "user-1",
    activeMap: map,
    selectedMap: map,
    selectedActor: actor,
    activePopup: "sheet",
    boardSeenCells: [],
    fogPreviewUserId: undefined,
    playerMembers: [
      {
        userId: "user-1",
        name: "Fede",
        email: "fede@example.com",
        role: "dm"
      }
    ],
    dmFogEnabled: false,
    dmFogUserId: null,
    selectedMapAvailableActors: [],
    actorCreatorKind: "character",
    filteredCatalog: [],
    selectedMonsterTemplate: null,
    movementPreviews: [],
    measurePreviews: [],
    mapPings: [],
    viewRecall: null,
    filteredCurrentMapRoster: [],
    filteredSelectedMapRoster: [],
    editingMap: null,
    mapEditorMode: null,
    canUndoEditingMap: false,
    canRedoEditingMap: false,
    canPersistEditingMap: false,
    onSetActivePopup: () => undefined,
    onOpenCampaignHome: () => undefined,
    onSelectMap: () => undefined,
    onSelectActor: () => undefined,
    onSetDmFogEnabled: () => undefined,
    onSetDmFogUserId: () => undefined,
    onActorCreatorKindChange: () => undefined,
    onMonsterQueryChange: () => undefined,
    onSelectMonster: () => undefined,
    onResetFog: noopAsync,
    onClearFog: noopAsync,
    onSelectedMapItemCountChange: () => undefined,
    onAssignActorToMap: () => undefined,
    onRemoveActorFromMap: () => undefined,
    onShowMap: () => undefined,
    onStartCreateMap: () => undefined,
    onStartEditMap: () => undefined,
    onChangeEditingMap: () => undefined,
    onSaveEditingMap: () => undefined,
    onReloadEditingMap: () => undefined,
    onUndoEditingMap: () => undefined,
    onRedoEditingMap: () => undefined,
    onSetEditingMapActive: () => undefined,
    onBackToMapsList: () => undefined,
    onMapUploadError: () => undefined,
    onCreateMapActor: async () => undefined,
    onCreateMapMonsterActor: async () => undefined,
    onMoveActor: async () => undefined,
    onBroadcastMovePreview: async () => undefined,
    onBroadcastMeasurePreview: async () => undefined,
    onToggleDoor: async () => undefined,
    onToggleDoorLock: async () => undefined,
    onCreateDrawing: async () => undefined,
    onUpdateDrawings: async () => undefined,
    onDeleteDrawings: async () => undefined,
    onClearDrawings: async () => undefined,
    onPing: async () => undefined,
    onPingAndRecall: async () => undefined,
    onSendChat: async () => undefined,
    onSaveActor: async () => undefined,
    onRealtimeSaveActor: async () => undefined,
    onRoll: async () => undefined,
    onUpdateToken: async () => undefined
  };
}

function renderBoardRoute(messages: ChatMessage[]) {
  const boardPageProps = createBoardPageProps(messages);
  const campaignRoute = {
    selectedCampaignId: "camp-1",
    snapshot: {
      campaign: boardPageProps.campaign,
      currentUser: {
        id: "user-1",
        name: "Fede",
        email: "fede@example.com",
        isAdmin: false
      },
      role: "dm",
      catalog: [],
      compendium: boardPageProps.compendium,
      playerVision: {}
    },
    roomStatus: "online",
    hubPageProps: {} as CampaignRouteContextValue["hubPageProps"],
    boardPageProps
  } as CampaignRouteContextValue;

  return render(
    <CampaignRouteProvider value={campaignRoute}>
      <CampaignBoardRouteContent />
    </CampaignRouteProvider>
  );
}

describe("CampaignBoardRouteContent chat integration", () => {
  it("keeps the floating chat updated while the sheet modal stays open", async () => {
    const initialMessages = createMessages();
    const { rerender } = renderBoardRoute(initialMessages);

    expect(await screen.findByText("Character Sheet Stub", undefined, { timeout: 5_000 })).not.toBeNull();
    expect(await screen.findByText("hello room", undefined, { timeout: 5_000 })).not.toBeNull();

    const nextMessages: ChatMessage[] = [
      ...initialMessages,
      {
        id: "msg-2",
        campaignId: "camp-1",
        userId: "user-1",
        userName: "Fede",
        text: "Fede initiative: 2d20kh1+3",
        createdAt: "2026-03-31T10:01:00.000Z",
        kind: "roll",
        roll: {
          id: "roll-1",
          label: "Fede initiative",
          notation: "2d20kh1+3",
          rolls: [5, 17],
          modifier: 0,
          total: 20,
          breakdown: "(2d20kh1[5, 17 -> 17] + 3)",
          createdAt: "2026-03-31T10:01:00.000Z"
        }
      }
    ];

    const updatedBoardPageProps = createBoardPageProps(nextMessages);
    const updatedRoute = {
      selectedCampaignId: "camp-1",
      snapshot: {
        campaign: updatedBoardPageProps.campaign,
        currentUser: {
          id: "user-1",
          name: "Fede",
          email: "fede@example.com",
          isAdmin: false
        },
        role: "dm",
        catalog: [],
        compendium: updatedBoardPageProps.compendium,
        playerVision: {}
      },
      roomStatus: "online",
      hubPageProps: {} as CampaignRouteContextValue["hubPageProps"],
      boardPageProps: updatedBoardPageProps
    } as CampaignRouteContextValue;

    rerender(
      <CampaignRouteProvider value={updatedRoute}>
        <CampaignBoardRouteContent />
      </CampaignRouteProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Fede initiative")).not.toBeNull();
    });
    expect(screen.getByText("20")).not.toBeNull();
  });
});
