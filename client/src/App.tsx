import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Castle, Eye, FilePlus2, Map as MapIcon, Minus, Pencil, Plus, ScrollText, Shield, Trash2, Users } from "lucide-react";

import type {
  ActorKind,
  ActorSheet,
  AuthPayload,
  CampaignMap,
  CampaignSnapshot,
  CampaignSummary,
  ClientRoomMessage,
  DrawingStroke,
  MapPing,
  MapViewportRecall,
  MeasurePreview,
  MemberRole,
  MonsterTemplate,
  Point,
  ServerRoomMessage,
  TokenMovementPreview
} from "@shared/types";

import { apiRequest } from "./api";
import { AdminPanel } from "./components/AdminPanel";
import { BoardCanvas } from "./components/BoardCanvas";
import { CharacterSheet } from "./components/CharacterSheet";
import { ChatPanel } from "./components/ChatPanel";
import { MapConfigurator } from "./components/MapConfigurator";
import { WorkspaceModal } from "./components/WorkspaceModal";
import { createClientActorDraft, createClientMapDraft, cloneMap, formatMonsterModifier } from "./lib/drafts";
import { toErrorMessage } from "./lib/errors";
import { readJson, writeJson } from "./lib/storage";
import { useAppRouter } from "./router";
import { computeVisibleCellsForUser, tokenCellKey } from "@shared/vision";

const sessionStorageKey = "dnd-board-session";
const selectedCampaignStorageKey = "dnd-board-selected-campaign";

type AuthMode = "login" | "register";
type ActorTypeFilter = "all" | ActorKind;

interface BannerState {
  tone: "info" | "error";
  text: string;
}

interface SharedMovementPreviewState {
  actorId: string;
  mapId: string;
  preview: TokenMovementPreview;
}

interface SharedMeasurePreviewState {
  userId: string;
  mapId: string;
  preview: MeasurePreview;
}

export default function App() {
  const { route, navigate } = useAppRouter();
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [session, setSession] = useState<AuthPayload | null>(() => readJson<AuthPayload>(sessionStorageKey));
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [selectedCampaignId, setSelectedCampaignIdState] = useState<string | null>(() =>
    route.name === "campaign" ? route.campaignId : readJson<string>(selectedCampaignStorageKey)
  );
  const [snapshot, setSnapshot] = useState<CampaignSnapshot | null>(null);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const [selectedBoardItemCount, setSelectedBoardItemCount] = useState(0);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [createCampaignName, setCreateCampaignName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [actorSearch, setActorSearch] = useState("");
  const [mapActorSearch, setMapActorSearch] = useState("");
  const [actorTypeFilter, setActorTypeFilter] = useState<ActorTypeFilter>("all");
  const [mapActorTypeFilter, setMapActorTypeFilter] = useState<ActorTypeFilter>("all");
  const [actorCreatorKind, setActorCreatorKind] = useState<ActorKind>("character");
  const [actorCreatorOpen, setActorCreatorOpen] = useState(false);
  const [actorDraft, setActorDraft] = useState<ActorSheet | null>(() => createClientActorDraft("character", session?.user.id));
  const [inviteDraft, setInviteDraft] = useState({ label: "Open seat", role: "player" as MemberRole });
  const [monsterQuery, setMonsterQuery] = useState("");
  const [selectedMonsterId, setSelectedMonsterId] = useState<string | null>(null);
  const [mapDraft, setMapDraft] = useState<CampaignMap | null>(null);
  const [newMapDraft, setNewMapDraft] = useState<CampaignMap>(() => createClientMapDraft("New Map"));
  const [mapEditorMode, setMapEditorMode] = useState<"create" | "edit" | null>(null);
  const [dmFogEnabled, setDmFogEnabled] = useState(false);
  const [dmFogUserId, setDmFogUserId] = useState<string | null>(null);
  const [activePopup, setActivePopup] = useState<"sheet" | "actors" | "maps" | "room" | null>(null);
  const [roomStatus, setRoomStatus] = useState<"offline" | "connecting" | "online">("offline");
  const [mapPings, setMapPings] = useState<MapPing[]>([]);
  const [viewportRecall, setViewportRecall] = useState<MapViewportRecall | null>(null);
  const [sharedMovementPreviews, setSharedMovementPreviews] = useState<Record<string, SharedMovementPreviewState>>({});
  const [sharedMeasurePreviews, setSharedMeasurePreviews] = useState<Record<string, SharedMeasurePreviewState>>({});
  const roomSocketRef = useRef<WebSocket | null>(null);

  const deferredMonsterQuery = useDeferredValue(monsterQuery);

  useEffect(() => {
    if (!banner) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setBanner((current) => (current === banner ? null : current));
    }, 10000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [banner]);

  useEffect(() => {
    writeJson(sessionStorageKey, session);
  }, [session]);

  useEffect(() => {
    writeJson(selectedCampaignStorageKey, selectedCampaignId);
  }, [selectedCampaignId]);

  useEffect(() => {
    if (route.name === "campaign") {
      setSelectedCampaignIdState((current) => (current === route.campaignId ? current : route.campaignId));
    }
  }, [route]);

  useEffect(() => {
    if (route.name === "home" && selectedCampaignId && session) {
      navigate({ name: "campaign", campaignId: selectedCampaignId }, { replace: true });
    }
  }, [navigate, route.name, selectedCampaignId, session]);

  useEffect(() => {
    if (!session) {
      setCampaigns([]);
      setSnapshot(null);
      return;
    }

    void refreshCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  useEffect(() => {
    if (!session?.token) {
      return;
    }

    void apiRequest<AuthPayload["user"]>("/auth/me", { token: session.token })
      .then((user) => {
        setSession((current) =>
          current && current.token === session.token
            ? {
                ...current,
                user
              }
            : current
        );
      })
      .catch(() => undefined);
  }, [session?.token]);

  useEffect(() => {
    if (route.name === "admin" && session && !session.user.isAdmin) {
      navigate({ name: "home" }, { replace: true });
    }
  }, [navigate, route.name, session]);

  useEffect(() => {
    if (!session || !selectedCampaignId || route.name !== "campaign") {
      if (roomSocketRef.current) {
        roomSocketRef.current.close();
        roomSocketRef.current = null;
      }

      setRoomStatus("offline");
      setSnapshot(null);
      setMapPings([]);
      setViewportRecall(null);
      setSharedMovementPreviews({});
      setSharedMeasurePreviews({});
      return;
    }

    setSnapshot(null);
    setRoomStatus("connecting");
    let disposed = false;
    let socket: WebSocket | null = null;

    const handleOpen = () => {
      if (!socket) {
        return;
      }

      socket.send(
        JSON.stringify({
          type: "room:join",
          token: session.token,
          campaignId: selectedCampaignId
        } satisfies ClientRoomMessage)
      );
    };

    const handleMessage = (event: MessageEvent<string>) => {
      try {
        const message = JSON.parse(event.data) as ServerRoomMessage;

        if (message.type === "room:snapshot") {
          setRoomStatus("online");
          startTransition(() => {
            setSnapshot(message.snapshot);
          });
          return;
        }

        if (message.type === "room:token-preview") {
          setSharedMovementPreviews((current) => {
            if (!message.preview) {
              if (!current[message.actorId]) {
                return current;
              }

              const next = { ...current };
              delete next[message.actorId];
              return next;
            }

            return {
              ...current,
              [message.actorId]: {
                actorId: message.actorId,
                mapId: message.mapId,
                preview: message.preview
              }
            };
          });
          return;
        }

        if (message.type === "room:measure-preview") {
          setSharedMeasurePreviews((current) => {
            if (!message.preview) {
              if (!current[message.userId]) {
                return current;
              }

              const next = { ...current };
              delete next[message.userId];
              return next;
            }

            return {
              ...current,
              [message.userId]: {
                userId: message.userId,
                mapId: message.mapId,
                preview: message.preview
              }
            };
          });
          return;
        }

        if (message.type === "room:ping") {
          enqueuePing(message.ping);
          return;
        }

        if (message.type === "room:view-recall") {
          setViewportRecall(message.recall);
          return;
        }

        if (message.type === "room:joined") {
          setRoomStatus("online");
          return;
        }

        if (message.type === "room:error") {
          setBanner({ tone: "error", text: message.message });
        }
      } catch {
        setBanner({ tone: "error", text: "Received an invalid realtime payload." });
      }
    };

    const handleClose = () => {
      if (!disposed) {
        setRoomStatus("offline");
      }
    };

    const handleError = () => {
      if (!disposed) {
        setBanner({ tone: "error", text: "Room connection interrupted." });
      }
    };

    const connectTimeoutId = window.setTimeout(() => {
      if (disposed) {
        return;
      }

      socket = new WebSocket(buildRoomSocketUrl());
      roomSocketRef.current = socket;
      socket.addEventListener("open", handleOpen);
      socket.addEventListener("message", handleMessage);
      socket.addEventListener("close", handleClose);
      socket.addEventListener("error", handleError);
    }, 0);

    return () => {
      disposed = true;
      window.clearTimeout(connectTimeoutId);

      socket?.removeEventListener("open", handleOpen);
      socket?.removeEventListener("message", handleMessage);
      socket?.removeEventListener("close", handleClose);
      socket?.removeEventListener("error", handleError);

      if (roomSocketRef.current === socket) {
        roomSocketRef.current = null;
      }

      if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
        socket.close();
      }

      setRoomStatus("offline");
    };
  }, [route.name, selectedCampaignId, session?.token]);

  useEffect(() => {
    setMapPings([]);
    setViewportRecall(null);
    setSharedMovementPreviews({});
    setSharedMeasurePreviews({});
  }, [selectedCampaignId]);

  function setSelectedCampaignId(nextCampaignId: string | null, options?: { replace?: boolean }) {
    setSelectedCampaignIdState(nextCampaignId);
    navigate(nextCampaignId ? { name: "campaign", campaignId: nextCampaignId } : { name: "home" }, options);
  }

  const campaign = snapshot?.campaign;
  const role = snapshot?.role ?? "player";
  const activeMap = useMemo(
    () => campaign?.maps.find((entry) => entry.id === campaign.activeMapId) ?? campaign?.maps[0],
    [campaign?.activeMapId, campaign?.maps]
  );
  const selectedMap = useMemo(
    () => campaign?.maps.find((entry) => entry.id === selectedMapId) ?? activeMap,
    [activeMap, campaign?.maps, selectedMapId]
  );
  const selectedActor = useMemo(
    () => campaign?.actors.find((entry) => entry.id === selectedActorId) ?? null,
    [campaign?.actors, selectedActorId]
  );
  const activeMapTokens = useMemo(
    () => campaign?.tokens.filter((token) => token.mapId === activeMap?.id && token.visible) ?? [],
    [activeMap?.id, campaign?.tokens]
  );
  const fogPreviewUserId = role === "dm" && dmFogEnabled ? dmFogUserId ?? undefined : undefined;
  const boardSeenCells = activeMap
    ? role === "dm"
      ? fogPreviewUserId
        ? campaign?.exploration[fogPreviewUserId]?.[activeMap.id] ?? []
        : []
      : snapshot?.playerVision[activeMap.id] ?? []
    : [];
  const boardVisibleCells = useMemo(() => {
    if (!activeMap || !campaign || !session) {
      return new Set<string>();
    }

    return computeVisibleCellsForUser({
      map: activeMap,
      actors: campaign.actors,
      tokens: activeMapTokens,
      userId: fogPreviewUserId ?? session.user.id,
      role: role === "dm" && !fogPreviewUserId ? "dm" : "player"
    });
  }, [activeMap, activeMapTokens, campaign, fogPreviewUserId, role, session]);
  const boardSeenCellSet = useMemo(() => new Set(boardSeenCells), [boardSeenCells]);
  const visibleMapTokens = useMemo(() => {
    if (!activeMap) {
      return [];
    }

    if (role === "dm") {
      return activeMapTokens;
    }

    return activeMapTokens.filter((token) => {
      const cell = tokenCellKey(activeMap, token);
      return boardVisibleCells.has(cell) || boardSeenCellSet.has(cell);
    });
  }, [activeMap, activeMapTokens, boardSeenCellSet, boardVisibleCells, role]);
  const activeMapAssignments = useMemo(
    () => campaign?.mapAssignments.filter((assignment) => assignment.mapId === activeMap?.id) ?? [],
    [activeMap?.id, campaign?.mapAssignments]
  );
  const activeMapTokenByActorId = useMemo(
    () => new Map(activeMapTokens.map((token) => [token.actorId, token])),
    [activeMapTokens]
  );
  const visibleMapTokenByActorId = useMemo(
    () => new Map(visibleMapTokens.map((token) => [token.actorId, token])),
    [visibleMapTokens]
  );
  const currentMapRoster = useMemo(
    () =>
      activeMapAssignments.flatMap((assignment) => {
        const actor = campaign?.actors.find((entry) => entry.id === assignment.actorId) ?? null;
        const token = activeMapTokenByActorId.get(assignment.actorId) ?? null;
        const visibleToken = visibleMapTokenByActorId.get(assignment.actorId) ?? null;

        if (role === "dm") {
          if (!actor) {
            return [];
          }

          return [
            {
              actor,
              actorKind: actor.kind,
              assignment,
              color: token?.color ?? actor.color,
              label: token?.label ?? actor.name,
              token
            }
          ];
        }

        if (actor && actor.kind === "character" && actor.ownerId === session?.user.id) {
          return [
            {
              actor,
              actorKind: actor.kind,
              assignment,
              color: token?.color ?? actor.color,
              label: token?.label ?? actor.name,
              token
            }
          ];
        }

        if (!visibleToken) {
          return [];
        }

        return [
          {
            actor: null,
            actorKind: visibleToken.actorKind,
            assignment,
            color: visibleToken.color,
            label: visibleToken.label,
            token: visibleToken
          }
        ];
      }),
    [activeMapAssignments, activeMapTokenByActorId, campaign?.actors, role, session?.user.id, visibleMapTokenByActorId]
  );
  const normalizedActorSearch = actorSearch.trim().toLowerCase();
  const normalizedMapActorSearch = mapActorSearch.trim().toLowerCase();
  const availableActors = useMemo(() => {
    if (role !== "dm" || !campaign) {
      return [];
    }

    return campaign.actors
      .filter((actor) =>
        (actorTypeFilter === "all" || actor.kind === actorTypeFilter) &&
        (normalizedActorSearch
          ? [actor.name, actor.kind, actor.species, actor.className].some((value) =>
              value.toLowerCase().includes(normalizedActorSearch)
            )
          : true)
      )
      .map((actor) => ({
      actor,
      activeMaps: campaign.maps.filter((map) =>
        campaign.mapAssignments.some((assignment) => assignment.actorId === actor.id && assignment.mapId === map.id)
      ),
      onCurrentMap: campaign.mapAssignments.some(
        (assignment) => assignment.actorId === actor.id && assignment.mapId === activeMap?.id
      )
    }));
  }, [activeMap?.id, actorTypeFilter, campaign, normalizedActorSearch, role]);
  const filteredCurrentMapRoster = useMemo(
    () =>
      currentMapRoster.filter(({ actor, actorKind, label }) =>
        (mapActorTypeFilter === "all" || actorKind === mapActorTypeFilter) &&
        (normalizedMapActorSearch
          ? [label, actorKind, actor?.name ?? "", actor?.species ?? ""].some((value) =>
              value.toLowerCase().includes(normalizedMapActorSearch)
            )
          : true)
      ),
    [currentMapRoster, mapActorTypeFilter, normalizedMapActorSearch]
  );
  const playerMembers = useMemo(
    () => campaign?.members.filter((member) => member.role === "player") ?? [],
    [campaign?.members]
  );
  const filteredCatalog = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    const query = deferredMonsterQuery.trim().toLowerCase();

    if (!query) {
      return snapshot.catalog;
    }

    return snapshot.catalog.filter((monster) =>
      [monster.name, monster.source, monster.challengeRating].some((field) =>
        field.toLowerCase().includes(query)
      )
    );
  }, [deferredMonsterQuery, snapshot]);
  const selectedMonsterTemplate = useMemo(
    () => filteredCatalog.find((monster) => monster.id === selectedMonsterId) ?? filteredCatalog[0] ?? null,
    [filteredCatalog, selectedMonsterId]
  );

  useEffect(() => {
    if (!campaign) {
      setSelectedMapId(null);
      setSelectedActorId(null);
      setSelectedMonsterId(null);
      setActorSearch("");
      setMapActorSearch("");
      setActorTypeFilter("all");
      setMapActorTypeFilter("all");
      setActorCreatorOpen(false);
      setActorCreatorKind("character");
      setActorDraft(createClientActorDraft("character", session?.user.id));
      setMapDraft(null);
      setNewMapDraft(createClientMapDraft("New Map"));
      setMapEditorMode(null);
      setDmFogEnabled(false);
      setDmFogUserId(null);
      setActivePopup(null);
      return;
    }

    if (!selectedMapId || !campaign.maps.some((entry) => entry.id === selectedMapId)) {
      setSelectedMapId(campaign.activeMapId || campaign.maps[0]?.id || null);
    }

    if (selectedActorId && !campaign.actors.some((entry) => entry.id === selectedActorId)) {
      setSelectedActorId(null);
    }
  }, [campaign, selectedActorId, selectedMapId]);

  useEffect(() => {
    if (role !== "dm") {
      setDmFogEnabled(false);
      setDmFogUserId(null);
      return;
    }

    if (playerMembers.length === 0) {
      setDmFogEnabled(false);
      setDmFogUserId(null);
      return;
    }

    if (!dmFogUserId || !playerMembers.some((member) => member.userId === dmFogUserId)) {
      setDmFogUserId(playerMembers[0]?.userId ?? null);
    }
  }, [dmFogUserId, playerMembers, role]);

  useEffect(() => {
    setMapDraft(selectedMap ? cloneMap(selectedMap) : null);
  }, [selectedMap?.id]);

  useEffect(() => {
    if (!selectedMonsterTemplate) {
      setSelectedMonsterId(filteredCatalog[0]?.id ?? null);
      return;
    }

    if (!filteredCatalog.some((monster) => monster.id === selectedMonsterTemplate.id)) {
      setSelectedMonsterId(filteredCatalog[0]?.id ?? null);
    }
  }, [filteredCatalog, selectedMonsterTemplate]);

  useEffect(() => {
    setActorDraft(createClientActorDraft(actorCreatorKind, session?.user.id));
  }, [actorCreatorKind, session?.user.id]);

  useEffect(() => {
    if (activePopup === "maps") {
      setMapEditorMode(null);
    }
  }, [activePopup]);

  useEffect(() => {
    if (role !== "dm" || !activeMap || !selectedActor) {
      return;
    }

    const token = campaign?.tokens.find((entry) => entry.actorId === selectedActor.id && entry.mapId === activeMap.id);

    if (!token) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Delete" && event.key !== "Backspace") {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;

      if (event.defaultPrevented || selectedBoardItemCount > 0) {
        return;
      }

      if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || target?.isContentEditable) {
        return;
      }

      event.preventDefault();
      void removeToken(token.id, token.label, true);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeMap, campaign?.tokens, role, selectedActor, selectedBoardItemCount]);

  const editingMap = mapEditorMode === "create" ? newMapDraft : mapEditorMode === "edit" ? mapDraft : null;

  async function refreshCampaigns() {
    if (!session) {
      return;
    }

    try {
      const nextCampaigns = await apiRequest<CampaignSummary[]>("/campaigns", { token: session.token });
      setCampaigns(nextCampaigns);

      if (selectedCampaignId && !nextCampaigns.some((entry) => entry.id === selectedCampaignId)) {
        setSelectedCampaignId(null);
        setSnapshot(null);
      }
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function sendRoomMessage(message: ClientRoomMessage) {
    const socket = roomSocketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error("Room connection is not ready yet.");
    }

    socket.send(JSON.stringify(message));
  }

  function enqueuePing(ping: MapPing) {
    setMapPings((current) => (current.some((entry) => entry.id === ping.id) ? current : [...current, ping]));
    window.setTimeout(() => {
      setMapPings((current) => current.filter((entry) => entry.id !== ping.id));
    }, 2200);
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const payload = await apiRequest<AuthPayload>(authMode === "login" ? "/auth/login" : "/auth/register", {
        method: "POST",
        body: authForm
      });

      setSession(payload);
      setBanner({ tone: "info", text: authMode === "login" ? "Signed in." : "Account created." });
      setAuthForm({ name: "", email: "", password: "" });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  function handleLogout() {
    setSession(null);
    setSnapshot(null);
    setSelectedCampaignId(null);
    setActivePopup(null);
    setBanner(null);
  }

  async function createCampaign() {
    if (!session || !createCampaignName.trim()) {
      return;
    }

    try {
      const created = await apiRequest<CampaignSummary>("/campaigns", {
        method: "POST",
        token: session.token,
        body: { name: createCampaignName.trim() }
      });

      setCreateCampaignName("");
      await refreshCampaigns();
      setSelectedCampaignId(created.id);
      setBanner({ tone: "info", text: "Campaign created." });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function acceptInvite() {
    if (!session || !joinCode.trim()) {
      return;
    }

    try {
      const joined = await apiRequest<CampaignSummary>("/invites/accept", {
        method: "POST",
        token: session.token,
        body: { code: joinCode.trim() }
      });

      setJoinCode("");
      await refreshCampaigns();
      setSelectedCampaignId(joined.id);
      setBanner({ tone: "info", text: "Campaign joined." });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function createActor(nextDraft: ActorSheet) {
    if (!session || !selectedCampaignId || !nextDraft.name.trim()) {
      return;
    }

    try {
      const created = await apiRequest<ActorSheet>(`/campaigns/${selectedCampaignId}/actors`, {
        method: "POST",
        token: session.token,
        body: {
          name: nextDraft.name.trim(),
          kind: nextDraft.kind
        }
      });

      const draftToSave: ActorSheet = {
        ...nextDraft,
        id: created.id,
        campaignId: created.campaignId,
        ownerId: created.ownerId,
        name: nextDraft.name.trim()
      };

      await apiRequest<ActorSheet>(`/campaigns/${selectedCampaignId}/actors/${created.id}`, {
        method: "PUT",
        token: session.token,
        body: draftToSave
      });

      setSelectedActorId(created.id);
      setActorDraft(createClientActorDraft(actorCreatorKind, session?.user.id));
      setActorCreatorOpen(false);
      setBanner({ tone: "info", text: `${draftToSave.name} added to the roster.` });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function createInvite() {
    if (!session || !selectedCampaignId) {
      return;
    }

    try {
      await apiRequest(`/campaigns/${selectedCampaignId}/invites`, {
        method: "POST",
        token: session.token,
        body: inviteDraft
      });

      setBanner({ tone: "info", text: "Invite created." });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function createMonsterActor(template: MonsterTemplate) {
    if (!session || !selectedCampaignId) {
      return;
    }

    try {
      const created = await apiRequest<ActorSheet>(`/campaigns/${selectedCampaignId}/monsters`, {
        method: "POST",
        token: session.token,
        body: { templateId: template.id }
      });

      setSelectedActorId(created.id);
      setActorCreatorOpen(false);
      setBanner({ tone: "info", text: `${created.name} added to the roster.` });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function assignActorToCurrentMap(actorId: string) {
    if (!session || !selectedCampaignId || !activeMap) {
      return;
    }

    try {
      await apiRequest(`/campaigns/${selectedCampaignId}/maps/${activeMap.id}/actors`, {
        method: "POST",
        token: session.token,
        body: { actorId }
      });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function removeActorFromCurrentMap(actorId: string) {
    if (!session || !selectedCampaignId || !activeMap) {
      return;
    }

    try {
      await apiRequest(`/campaigns/${selectedCampaignId}/maps/${activeMap.id}/actors/${actorId}`, {
        method: "DELETE",
        token: session.token
      });

      if (selectedActorId === actorId) {
        setSelectedActorId(null);
      }
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function removeToken(tokenId: string, label: string, skipPrompt = false) {
    if (!session || !selectedCampaignId) {
      return;
    }

    if (!skipPrompt && !window.confirm(`Remove ${label} from the map?`)) {
      return;
    }

    try {
      await apiRequest(`/campaigns/${selectedCampaignId}/tokens/${tokenId}`, {
        method: "DELETE",
        token: session.token
      });
      setBanner({ tone: "info", text: `${label} removed from the map.` });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function deleteActor(actor: ActorSheet) {
    if (!session || !selectedCampaignId) {
      return;
    }

    if (!window.confirm(`Delete actor ${actor.name}? This also removes its tokens.`)) {
      return;
    }

    try {
      await apiRequest(`/campaigns/${selectedCampaignId}/actors/${actor.id}`, {
        method: "DELETE",
        token: session.token
      });

      if (selectedActorId === actor.id) {
        setSelectedActorId(null);
      }

      setBanner({ tone: "info", text: `${actor.name} deleted.` });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function createMap(nextMap: CampaignMap) {
    if (!session || !selectedCampaignId || !nextMap.name.trim()) {
      return;
    }

    try {
      const created = await apiRequest<CampaignMap>(`/campaigns/${selectedCampaignId}/maps`, {
        method: "POST",
        token: session.token,
        body: {
          ...nextMap,
          name: nextMap.name.trim()
        }
      });

      setNewMapDraft(createClientMapDraft("New Map"));
      setSelectedMapId(created.id);
      setMapDraft(cloneMap(created));
      setMapEditorMode("edit");
      setBanner({ tone: "info", text: "Map created." });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function saveMap(nextMap: CampaignMap) {
    if (!session || !selectedCampaignId) {
      return;
    }

    try {
      await apiRequest<CampaignMap>(`/campaigns/${selectedCampaignId}/maps/${nextMap.id}`, {
        method: "PUT",
        token: session.token,
        body: nextMap
      });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function saveActor(nextActor: ActorSheet) {
    if (!session || !selectedCampaignId) {
      return;
    }

    try {
      await apiRequest<ActorSheet>(`/campaigns/${selectedCampaignId}/actors/${nextActor.id}`, {
        method: "PUT",
        token: session.token,
        body: nextActor
      });

      setBanner({ tone: "info", text: "Sheet saved." });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function sendChat(text: string) {
    if (!selectedCampaignId) {
      return;
    }

    try {
      await sendRoomMessage({
        type: "chat:send",
        text
      });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function rollFromSheet(notation: string, label: string) {
    if (!selectedCampaignId) {
      return;
    }

    try {
      await sendRoomMessage({
        type: "roll:send",
        notation,
        label
      });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function moveActor(actorId: string, x: number, y: number) {
    if (!selectedCampaignId) {
      return;
    }

    try {
      await sendRoomMessage({
        type: "token:move",
        actorId,
        x,
        y
      });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function broadcastMovePreview(actorId: string, target: Point | null) {
    if (!selectedCampaignId) {
      return;
    }

    try {
      await sendRoomMessage({
        type: "token:preview",
        actorId,
        target
      });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function broadcastMeasurePreview(preview: MeasurePreview | null) {
    if (!selectedCampaignId) {
      return;
    }

    try {
      await sendRoomMessage({
        type: "measure:preview",
        preview
      });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function createDrawing(mapId: string, stroke: DrawingStroke) {
    if (!selectedCampaignId) {
      return;
    }

    try {
      await sendRoomMessage({
        type: "drawing:create",
        mapId,
        stroke
      });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function updateDrawings(mapId: string, drawings: Array<{ id: string; points: Point[]; rotation: number }>) {
    if (!selectedCampaignId || drawings.length === 0) {
      return;
    }

    try {
      await sendRoomMessage({
        type: "drawing:update",
        mapId,
        drawings
      });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function deleteDrawings(mapId: string, drawingIds: string[]) {
    if (!selectedCampaignId || drawingIds.length === 0) {
      return;
    }

    try {
      await sendRoomMessage({
        type: "drawing:delete",
        mapId,
        drawingIds
      });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function clearDrawings(mapId: string) {
    if (!selectedCampaignId) {
      return;
    }

    try {
      await sendRoomMessage({
        type: "drawing:clear",
        mapId
      });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function pingMap(point: Point) {
    if (!selectedCampaignId || !activeMap || !session) {
      return;
    }

    const ping: MapPing = {
      id: `png_${crypto.randomUUID().slice(0, 8)}`,
      mapId: activeMap.id,
      point,
      userId: session.user.id,
      userName: session.user.name,
      createdAt: new Date().toISOString()
    };

    enqueuePing(ping);

    try {
      await sendRoomMessage({
        type: "map:ping",
        pingId: ping.id,
        mapId: activeMap.id,
        point
      });
    } catch (error) {
      setMapPings((current) => current.filter((entry) => entry.id !== ping.id));
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function pingAndRecallMap(point: Point, center: Point, zoom: number) {
    if (!selectedCampaignId || !activeMap || !session) {
      return;
    }

    const ping: MapPing = {
      id: `png_${crypto.randomUUID().slice(0, 8)}`,
      mapId: activeMap.id,
      point,
      userId: session.user.id,
      userName: session.user.name,
      createdAt: new Date().toISOString()
    };

    enqueuePing(ping);

    try {
      await sendRoomMessage({
        type: "map:ping-recall",
        pingId: ping.id,
        mapId: activeMap.id,
        point,
        center,
        zoom
      });
    } catch (error) {
      setMapPings((current) => current.filter((entry) => entry.id !== ping.id));
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function toggleDoor(doorId: string) {
    if (!selectedCampaignId) {
      return;
    }

    try {
      await sendRoomMessage({
        type: "door:toggle",
        doorId
      });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  async function resetFog() {
    if (!selectedCampaignId || !activeMap) {
      return;
    }

    if (!window.confirm(`Reset remembered fog for all players on ${activeMap.name}?`)) {
      return;
    }

    try {
      await sendRoomMessage({
        type: "fog:reset",
        mapId: activeMap.id
      });
      setBanner({ tone: "info", text: "Fog memory reset for the active map." });
    } catch (error) {
      setBanner({ tone: "error", text: toErrorMessage(error) });
    }
  }

  if (!session) {
    return (
      <div className="app-shell auth-shell">
        <section className="hero-panel">
          <p className="eyebrow">Dungeon & Dragons 5e 2024</p>
          <h1>Campaign rooms, tactical maps, sheet rolls, line of sight, and monsters in one PWA.</h1>
          <p className="lede">
            Create a room, invite DMs or players, build characters and NPCs, pull monsters from a bestiary, and run the entire scene on a shared board.
          </p>
          <div className="hero-grid">
            <article className="hero-card">
              <h2>Interactive sheet</h2>
              <p>Dark, panel-based character sheet inspired by the layout you provided, with roll buttons across abilities and skills.</p>
            </article>
            <article className="hero-card">
              <h2>Encounter board</h2>
              <p>Multiple maps, adjustable grids, line of sight, token movement, drawing, and walls on a shared board.</p>
            </article>
            <article className="hero-card">
              <h2>Room workflow</h2>
              <p>One chat per campaign, invite codes with roles, and persistent campaign state on the backend.</p>
            </article>
          </div>
        </section>

        <section className="auth-panel">
          <div className="segmented">
            <button className={authMode === "login" ? "is-active" : ""} type="button" onClick={() => setAuthMode("login")}>
              Login
            </button>
            <button className={authMode === "register" ? "is-active" : ""} type="button" onClick={() => setAuthMode("register")}>
              Register
            </button>
          </div>

          <form className="stack-form" onSubmit={handleAuthSubmit}>
            {authMode === "register" && (
              <label>
                Name
                <input
                  value={authForm.name}
                  onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
                  required
                />
              </label>
            )}
            <label>
              Email
              <input
                type="email"
                value={authForm.email}
                onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={authForm.password}
                onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                required
              />
            </label>
            <button className="accent-button" type="submit">
              {authMode === "login" ? "Enter the table" : "Create account"}
            </button>
          </form>

        </section>
      </div>
    );
  }

  return (
    <div className={`app-shell workspace-shell${selectedCampaignId && snapshot ? " is-room-active" : ""}`}>
      <header className="topbar">
        <div className="topbar-brand">
          <p className="eyebrow">Logged in as {session.user.name}</p>
          <h1>DnD 2024 Board</h1>
        </div>
        {route.name === "campaign" && campaign && (
          <div className="topbar-room-status">
            <span className="status-chip status-title">{campaign.name}</span>
            <span className="status-chip">{activeMap?.name ?? "No map"}</span>
            <span className="status-chip">{role.toUpperCase()}</span>
            <span className={`status-chip status-${roomStatus}`}>{roomStatus}</span>
          </div>
        )}
        <div className="topbar-actions">
          {session.user.isAdmin && (
            <button type="button" className={route.name === "admin" ? "accent-button" : ""} onClick={() => navigate({ name: "admin" })}>
              <Shield size={15} />
              <span>Admin</span>
            </button>
          )}
          <button type="button" onClick={() => setSelectedCampaignId(null)}>
            Campaigns
          </button>
          <button type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {route.name === "admin" ? (
        <AdminPanel
          token={session.token}
          currentUserId={session.user.id}
          onStatus={(tone, text) => {
            setBanner({ tone, text });
          }}
        />
      ) : !selectedCampaignId ? (
        <main className="dashboard-grid">
          <section className="dark-card">
            <div className="panel-head">
              <div>
                <p className="panel-label">Create</p>
                <h2>New campaign room</h2>
              </div>
            </div>
            <div className="inline-form">
              <input
                placeholder="Campaign name"
                value={createCampaignName}
                onChange={(event) => setCreateCampaignName(event.target.value)}
              />
              <button className="accent-button" type="button" onClick={() => void createCampaign()}>
                Create
              </button>
            </div>
          </section>

          <section className="dark-card">
            <div className="panel-head">
              <div>
                <p className="panel-label">Join</p>
                <h2>Accept invite code</h2>
              </div>
            </div>
            <div className="inline-form">
              <input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="ABC123" />
              <button className="accent-button" type="button" onClick={() => void acceptInvite()}>
                Join
              </button>
            </div>
          </section>

          <section className="dark-card span-full">
            <div className="panel-head">
              <div>
                <p className="panel-label">Access</p>
                <h2>Your campaigns</h2>
              </div>
            </div>
            <p className="panel-caption">
              Only campaigns you created or joined through an invite are listed here.
            </p>
            <div className="campaign-grid">
              {campaigns.map((entry) => (
                <button key={entry.id} className="campaign-card" type="button" onClick={() => setSelectedCampaignId(entry.id)}>
                  <div className="campaign-card-head">
                    <strong>{entry.name}</strong>
                    <span className="badge">{entry.role}</span>
                  </div>
                  <p>
                    {entry.memberCount} members • {entry.actorCount} actors • {entry.mapCount} maps
                  </p>
                  <small>{new Date(entry.createdAt).toLocaleString()}</small>
                </button>
              ))}
              {campaigns.length === 0 && (
                <p className="empty-state">No accessible campaigns yet. Create one or join via invite code.</p>
              )}
            </div>
          </section>

        </main>
      ) : route.name !== "campaign" || !snapshot ? (
        <main className="dashboard-grid">
          <section className="dark-card span-full">
            <div className="panel-head">
              <div>
                <p className="panel-label">Room</p>
                <h2>Connecting to campaign</h2>
              </div>
              <span className="badge subtle">{roomStatus}</span>
            </div>
            <p className="panel-caption">Loading the active map, room chat, and current visibility state.</p>
          </section>
        </main>
      ) : (
        <>
          <main className="table-layout">
            <section className="table-map-shell">
              <BoardCanvas
                map={activeMap}
                tokens={campaign.tokens}
                actors={campaign.actors}
                selectedActor={selectedActor}
                role={role}
                currentUserId={session.user.id}
                playerSeenCells={boardSeenCells}
                fogPreviewUserId={fogPreviewUserId}
                fogPlayers={playerMembers.map((member) => ({ userId: member.userId, name: member.name }))}
                dmFogEnabled={dmFogEnabled}
                dmFogUserId={dmFogUserId}
                onSetDmFogEnabled={setDmFogEnabled}
                onSetDmFogUserId={setDmFogUserId}
                onResetFog={resetFog}
                onSelectActor={setSelectedActorId}
                onSelectedMapItemCountChange={setSelectedBoardItemCount}
                movementPreviews={Object.values(sharedMovementPreviews)}
                measurePreviews={Object.values(sharedMeasurePreviews)}
                pings={mapPings}
                viewRecall={viewportRecall}
                onMoveActor={moveActor}
                onBroadcastMovePreview={broadcastMovePreview}
                onBroadcastMeasurePreview={broadcastMeasurePreview}
                onToggleDoor={toggleDoor}
                onCreateDrawing={createDrawing}
                onUpdateDrawings={updateDrawings}
                onDeleteDrawings={deleteDrawings}
                onClearDrawings={clearDrawings}
                onPing={pingMap}
                onPingAndRecall={pingAndRecallMap}
              />

              <aside className="table-overlay table-menu">
                <section className="overlay-card overlay-nav">
                  <p className="panel-label">Menu</p>
                  <div className="overlay-nav-buttons">
                    <button type="button" onClick={() => setActivePopup("actors")}>
                      <Users size={15} />
                      <span>Actors</span>
                    </button>
                    <button type="button" onClick={() => setActivePopup("maps")}>
                      <MapIcon size={15} />
                      <span>Maps</span>
                    </button>
                    <button type="button" disabled={!selectedActor} onClick={() => setActivePopup("sheet")}>
                      <ScrollText size={15} />
                      <span>Sheet</span>
                    </button>
                    <button type="button" onClick={() => setActivePopup("room")}>
                      <Castle size={15} />
                      <span>Room</span>
                    </button>
                  </div>
                </section>

                <section className="overlay-card overlay-active-actors">
                  <div className="panel-head">
                    <div>
                      <p className="panel-label">Map</p>
                      <h3>Actors</h3>
                    </div>
                    <span className="badge subtle">{filteredCurrentMapRoster.length}</span>
                  </div>
                  <div className="list-stack compact-list">
                    {filteredCurrentMapRoster.map(({ actor, assignment, color, label }) => {
                      const canSelect = Boolean(actor);
                      const canDrag = Boolean(
                        actor && (role === "dm" || (actor.kind === "character" && actor.ownerId === session.user.id))
                      );

                      return (
                        <div key={`${assignment.mapId}:${assignment.actorId}`} className="overlay-token-row">
                          <div className={`overlay-token-chip ${actor && selectedActor?.id === actor.id ? "is-selected" : ""}`}>
                            <button
                              type="button"
                              className="overlay-token-drag"
                              disabled={!canDrag}
                              draggable={canDrag}
                              title={canDrag ? `Drag ${label} onto the board` : label}
                              onClick={() => {
                                if (actor) {
                                  setSelectedActorId(actor.id);
                                }
                              }}
                              onDragStart={(event) => {
                                if (!actor) {
                                  event.preventDefault();
                                  return;
                                }

                                event.dataTransfer.setData("application/x-dnd-actor-id", actor.id);
                                event.dataTransfer.effectAllowed = "move";
                                setSelectedActorId(actor.id);
                              }}
                            >
                              <span className="overlay-token-dot" style={{ background: color }}>
                                {label
                                  .split(/\s+/)
                                  .filter(Boolean)
                                  .slice(0, 2)
                                  .map((part) => part[0]?.toUpperCase() ?? "")
                                  .join("")}
                              </span>
                            </button>
                            <button
                              type="button"
                              className="overlay-token-name-button"
                              disabled={!canSelect}
                              title={label}
                              onClick={() => {
                                if (actor) {
                                  setSelectedActorId(actor.id);
                                }
                              }}
                            >
                              <span className="overlay-token-name">{label}</span>
                            </button>
                          </div>
                          {actor && (
                            <button
                              className="icon-action-button overlay-token-sheet-button"
                              type="button"
                              title="Open sheet"
                              disabled={
                                !(
                                  role === "dm" ||
                                  actor.sheetAccess === "full" ||
                                  (actor.kind === "character" && actor.ownerId === session.user.id)
                                )
                              }
                              onClick={() => {
                                setSelectedActorId(actor.id);
                                setActivePopup("sheet");
                              }}
                            >
                              <ScrollText size={13} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {filteredCurrentMapRoster.length === 0 && (
                      <p className="empty-state">No actors are assigned to this map.</p>
                    )}
                  </div>
                </section>
              </aside>

              <aside className="table-overlay table-chat">
                <ChatPanel messages={campaign.chat} onSend={sendChat} />
              </aside>
            </section>
          </main>

          {activePopup === "sheet" && (
            <WorkspaceModal title={selectedActor ? `${selectedActor.name} Sheet` : "Interactive Sheet"} size="wide" onClose={() => setActivePopup(null)}>
              <CharacterSheet
                actor={selectedActor}
                role={role}
                currentUserId={session.user.id}
                onSave={saveActor}
                onRoll={rollFromSheet}
              />
            </WorkspaceModal>
          )}

          {activePopup === "actors" && (
            <WorkspaceModal title="Actors" size="wide" onClose={() => setActivePopup(null)}>
              <div className="popup-grid actor-manager-grid">
                {role === "dm" && (
                  <section className="dark-card popup-card actor-list-card">
                    <div className="panel-head">
                      <div>
                        <p className="panel-label">Roster</p>
                        <h2>Available actors</h2>
                      </div>
                      <span className="badge subtle">{availableActors.length}</span>
                    </div>
                    <div className="actor-filter-row">
                      <input
                        placeholder="Search available actors"
                        value={actorSearch}
                        onChange={(event) => setActorSearch(event.target.value)}
                      />
                      <select value={actorTypeFilter} onChange={(event) => setActorTypeFilter(event.target.value as ActorTypeFilter)}>
                        <option value="all">All types</option>
                        <option value="character">Characters</option>
                        <option value="npc">NPCs</option>
                        <option value="monster">Monsters</option>
                        <option value="static">Static</option>
                      </select>
                    </div>
                    <div className="actor-list-scroll">
                      <div className="list-stack">
                        {availableActors.map(({ actor, activeMaps, onCurrentMap }) => (
                          <div key={actor.id} className="popup-row actor-popup-row">
                            <div className={`list-row actor-list-row-static ${selectedActor?.id === actor.id ? "is-selected" : ""}`}>
                              <div className="actor-row-main">
                                <span className="actor-row-name">{actor.name}</span>
                                <div className="actor-row-meta">
                                  <span className="badge subtle">{actor.kind}</span>
                                  {onCurrentMap && <span className="badge subtle">Assigned</span>}
                                  {activeMaps.map((map) => (
                                    <span key={map.id} className="badge map-badge">
                                      {map.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div className="actor-list-actions">
                              <button
                                className="icon-action-button"
                                type="button"
                                title="Open sheet"
                                onClick={() => {
                                  setSelectedActorId(actor.id);
                                  setActivePopup("sheet");
                                }}
                              >
                                <ScrollText size={15} />
                              </button>
                              {role === "dm" && !onCurrentMap && (
                                <button
                                  className="icon-action-button"
                                  type="button"
                                  title="Add actor to map"
                                  onClick={() => void assignActorToCurrentMap(actor.id)}
                                >
                                  <Plus size={15} />
                                </button>
                              )}
                              {role === "dm" && onCurrentMap && (
                                <button
                                  className="icon-action-button"
                                  type="button"
                                  title="Remove actor from map"
                                  onClick={() => void removeActorFromCurrentMap(actor.id)}
                                >
                                  <Minus size={15} />
                                </button>
                              )}
                              {role === "dm" && actor.ownerId === session.user.id && (
                                <button
                                  type="button"
                                  className="icon-action-button danger-button"
                                  title="Delete actor"
                                  onClick={() => void deleteActor(actor)}
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                        {availableActors.length === 0 && <p className="empty-state">No actors match that search.</p>}
                      </div>
                    </div>
                  </section>
                )}

                <section className="dark-card popup-card actor-list-card">
                  <div className="panel-head">
                    <div>
                      <p className="panel-label">Map</p>
                      <h2>Actors on map</h2>
                    </div>
                    <span className="badge subtle">{filteredCurrentMapRoster.length}</span>
                  </div>
                  <div className="actor-filter-row">
                    <input
                      placeholder="Search current map actors"
                      value={mapActorSearch}
                      onChange={(event) => setMapActorSearch(event.target.value)}
                    />
                    <select value={mapActorTypeFilter} onChange={(event) => setMapActorTypeFilter(event.target.value as ActorTypeFilter)}>
                      <option value="all">All types</option>
                      <option value="character">Characters</option>
                      <option value="npc">NPCs</option>
                      <option value="monster">Monsters</option>
                      <option value="static">Static</option>
                    </select>
                  </div>
                    <div className="actor-list-scroll">
                      <div className="list-stack">
                      {filteredCurrentMapRoster.map(({ actor, token, actorKind, assignment, label }) => {
                        const canRemoveFromMap = role === "dm" && Boolean(actor);

                        return (
                          <div key={`${assignment.mapId}:${assignment.actorId}`} className="popup-row actor-popup-row">
                            <div className={`list-row actor-list-row-static ${actor && selectedActor?.id === actor.id ? "is-selected" : ""}`}>
                              <div className="actor-row-main">
                                <span className="actor-row-name">{label}</span>
                                <div className="actor-row-meta">
                                  <span className="badge subtle">{actorKind}</span>
                                  {token && <span className="badge subtle">On board</span>}
                                  {actor ? (
                                    <span className="badge subtle">
                                      {role === "dm" ? "Sheet" : actor.ownerId === session.user.id ? "Yours" : "Seen"}
                                    </span>
                                  ) : (
                                    <span className="badge subtle">Seen</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="actor-list-actions">
                              {actor && (
                                <button
                                  className="icon-action-button"
                                  type="button"
                                  title="Open sheet"
                                  disabled={
                                    !(
                                      role === "dm" ||
                                      actor.sheetAccess === "full" ||
                                      (actor.kind === "character" && actor.ownerId === session.user.id)
                                    )
                                  }
                                  onClick={() => {
                                    setSelectedActorId(actor.id);
                                    setActivePopup("sheet");
                                  }}
                                >
                                  <ScrollText size={15} />
                                </button>
                              )}
                              {canRemoveFromMap && actor && (
                                <button
                                  className="icon-action-button"
                                  type="button"
                                  title="Remove actor from map"
                                  onClick={() => void removeActorFromCurrentMap(actor.id)}
                                >
                                  <Minus size={15} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {filteredCurrentMapRoster.length === 0 && <p className="empty-state">No actors are assigned to this map.</p>}
                    </div>
                  </div>
                </section>

                <section className="dark-card popup-card actor-create-card">
                    <div className="panel-head">
                      <div>
                        <p className="panel-label">Create</p>
                        <h2>New actor</h2>
                      </div>
                      <button
                        className={actorCreatorOpen ? "accent-button" : ""}
                        type="button"
                        onClick={() => setActorCreatorOpen((value) => !value)}
                      >
                        {actorCreatorOpen ? "Close" : "Create actor"}
                      </button>
                    </div>
                    {actorCreatorOpen && (
                      <div className="stack-form">
                        <div className="inline-form compact">
                          <select
                            value={actorCreatorKind}
                            onChange={(event) => setActorCreatorKind(event.target.value as ActorKind)}
                          >
                            <option value="character">Character</option>
                            {role === "dm" && <option value="npc">NPC</option>}
                            {role === "dm" && <option value="monster">Monster</option>}
                            {role === "dm" && <option value="static">Static</option>}
                          </select>
                        </div>

                        {actorCreatorKind === "monster" ? (
                          <div className="popup-grid monster-browser">
                            <section className="sheet-panel">
                              <input
                                placeholder="Search monsters"
                                value={monsterQuery}
                                onChange={(event) => setMonsterQuery(event.target.value)}
                              />
                              <div className="monster-list">
                                {filteredCatalog.map((monster) => (
                                  <button
                                    key={monster.id}
                                    className={`monster-card ${selectedMonsterTemplate?.id === monster.id ? "is-selected" : ""}`}
                                    type="button"
                                    onClick={() => setSelectedMonsterId(monster.id)}
                                  >
                                    <span>{monster.name}</span>
                                    <small>
                                      CR {monster.challengeRating} • AC {monster.armorClass} • HP {monster.hitPoints}
                                    </small>
                                  </button>
                                ))}
                                {filteredCatalog.length === 0 && <p className="empty-state">No monsters match that search.</p>}
                              </div>
                            </section>
                            <section className="sheet-panel monster-preview-card">
                              {selectedMonsterTemplate ? (
                                <>
                                  <div className="panel-head">
                                    <div>
                                      <p className="panel-label">Preview</p>
                                      <h2>{selectedMonsterTemplate.name}</h2>
                                    </div>
                                    <button
                                      className="accent-button"
                                      type="button"
                                      onClick={() => void createMonsterActor(selectedMonsterTemplate)}
                                    >
                                      Add to roster
                                    </button>
                                  </div>
                                  <div className="monster-preview-summary">
                                    <span className="badge">CR {selectedMonsterTemplate.challengeRating}</span>
                                    <span className="badge subtle">{selectedMonsterTemplate.source}</span>
                                    <span className="badge subtle">AC {selectedMonsterTemplate.armorClass}</span>
                                    <span className="badge subtle">HP {selectedMonsterTemplate.hitPoints}</span>
                                    <span className="badge subtle">Speed {selectedMonsterTemplate.speed}</span>
                                  </div>
                                  <div className="ability-card-grid">
                                    {Object.entries(selectedMonsterTemplate.abilities).map(([key, value]) => (
                                      <div key={key} className="ability-card">
                                        <header>
                                          <h4>{key.toUpperCase()}</h4>
                                          <span>{formatMonsterModifier(value)}</span>
                                        </header>
                                        <strong>{value}</strong>
                                      </div>
                                    ))}
                                  </div>
                                </>
                              ) : (
                                <p className="empty-state">Select a monster to preview its stat block.</p>
                              )}
                            </section>
                          </div>
                        ) : (
                          actorDraft && (
                            <CharacterSheet
                              actor={actorDraft}
                              role={role}
                              currentUserId={session.user.id}
                              onSave={createActor}
                              onRoll={rollFromSheet}
                            />
                          )
                        )}
                      </div>
                    )}
                  </section>
              </div>
            </WorkspaceModal>
          )}

          {activePopup === "maps" && (
            <WorkspaceModal
              title="Maps"
              size={editingMap ? "full" : "compact"}
              onClose={() => {
                if (editingMap) {
                  setMapEditorMode(null);
                  return;
                }

                setActivePopup(null);
              }}
            >
              <div className="maps-popup">
                {!editingMap ? (
                  <section className="dark-card popup-card maps-list-card maps-list-card-compact">
                    <div className="panel-head">
                      <div>
                        <p className="panel-label">Maps</p>
                        <h2>Board selection</h2>
                      </div>
                    </div>
                    <div className="maps-list-scroll">
                      <div className="list-stack">
                        {campaign.maps.map((map) => (
                          <div key={map.id} className="popup-row">
                            <div className="list-row map-list-row">
                              <div className="actor-row-main">
                                <span className="actor-row-name">{map.name}</span>
                                <div className="actor-row-meta">
                                  <span className="badge subtle">{map.id === activeMap?.id ? "Active" : "Standby"}</span>
                                  <span className="badge subtle">
                                    {map.width}×{map.height}
                                  </span>
                                </div>
                              </div>
                            </div>
                            {role === "dm" && map.id !== activeMap?.id && (
                              <button
                                className="icon-action-button"
                                type="button"
                                title="Show map"
                                onClick={() => {
                                  void sendRoomMessage({ type: "map:set-active", mapId: map.id }).catch((error: unknown) => {
                                    setBanner({ tone: "error", text: toErrorMessage(error) });
                                  });
                                }}
                              >
                                <Eye size={15} />
                              </button>
                            )}
                            {role === "dm" && (
                              <button
                                className="icon-action-button"
                                type="button"
                                title="Edit map"
                                onClick={() => {
                                  setSelectedMapId(map.id);
                                  setMapDraft(cloneMap(map));
                                  setMapEditorMode("edit");
                                }}
                              >
                                <Pencil size={15} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    {role === "dm" && (
                      <button
                        className={mapEditorMode === "create" ? "accent-button" : ""}
                        type="button"
                        onClick={() => {
                          setNewMapDraft(createClientMapDraft("New Map"));
                          setMapEditorMode("create");
                        }}
                      >
                        <FilePlus2 size={15} />
                        <span>New Map</span>
                      </button>
                    )}
                  </section>
                ) : (
                  <section className="dark-card popup-card maps-editor-card">
                    <div className="panel-head">
                      <div>
                        <p className="panel-label">Editor</p>
                        <h2>{mapEditorMode === "create" ? "New Map" : selectedMap?.name ?? "Map details"}</h2>
                      </div>
                    </div>
                    {role === "dm" && (
                      <div className="inline-form compact map-editor-savebar">
                        {mapEditorMode === "edit" && mapDraft && (
                          <button
                            className="accent-button"
                            type="button"
                            disabled={mapDraft.id === activeMap?.id}
                            onClick={() => {
                              void sendRoomMessage({ type: "map:set-active", mapId: mapDraft.id }).catch((error: unknown) => {
                                setBanner({ tone: "error", text: toErrorMessage(error) });
                              });
                            }}
                          >
                            {mapDraft.id === activeMap?.id ? "Current Board" : "Set Active Board"}
                          </button>
                        )}
                        {mapEditorMode === "create" ? (
                          <>
                            <button type="button" onClick={() => setNewMapDraft(createClientMapDraft("New Map"))}>
                              Reload
                            </button>
                            <button className="accent-button" type="button" onClick={() => void createMap(newMapDraft)}>
                              Save
                            </button>
                          </>
                        ) : (
                          mapDraft && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  if (selectedMap) {
                                    setMapDraft(cloneMap(selectedMap));
                                  }
                                }}
                              >
                                Reload
                              </button>
                              <button className="accent-button" type="button" onClick={() => void saveMap(mapDraft)}>
                                Save
                              </button>
                            </>
                          )
                        )}
                      </div>
                    )}
                    <MapConfigurator
                      map={editingMap}
                      disabled={role !== "dm"}
                      onChange={mapEditorMode === "create" ? setNewMapDraft : (nextMap) => setMapDraft(nextMap)}
                      onUploadError={(message) => setBanner({ tone: "error", text: message })}
                    />
                  </section>
                )}
              </div>
            </WorkspaceModal>
          )}

          {activePopup === "room" && (
            <WorkspaceModal title="Room" onClose={() => setActivePopup(null)}>
              <div className="popup-grid two-columns">
                <section className="dark-card popup-card">
                  <div className="panel-head">
                    <div>
                      <p className="panel-label">Members</p>
                      <h2>{campaign.name}</h2>
                    </div>
                    <span className="badge">{role}</span>
                  </div>
                  <div className="member-list">
                    {campaign.members.map((member) => (
                      <div key={member.userId} className="member-row">
                        <span>{member.name}</span>
                        <span className="badge subtle">{member.role}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {role === "dm" ? (
                  <section className="dark-card popup-card">
                    <div className="panel-head">
                      <div>
                        <p className="panel-label">Invites</p>
                        <h2>Role-based access</h2>
                      </div>
                    </div>
                    <div className="stack-form compact">
                      <input
                        value={inviteDraft.label}
                        onChange={(event) => setInviteDraft({ ...inviteDraft, label: event.target.value })}
                      />
                      <div className="inline-form compact">
                        <select
                          value={inviteDraft.role}
                          onChange={(event) => setInviteDraft({ ...inviteDraft, role: event.target.value as MemberRole })}
                        >
                          <option value="player">Player</option>
                          <option value="dm">Dungeon Master</option>
                        </select>
                        <button type="button" onClick={() => void createInvite()}>
                          Create
                        </button>
                      </div>
                    </div>
                    <div className="invite-list">
                      {campaign.invites.map((invite) => (
                        <div key={invite.id} className="invite-card">
                          <strong>{invite.code}</strong>
                          <span>{invite.label}</span>
                          <small>{invite.role}</small>
                        </div>
                      ))}
                      {campaign.invites.length === 0 && <p className="empty-state">No active invites.</p>}
                    </div>
                  </section>
                ) : (
                  <section className="dark-card popup-card">
                    <div className="panel-head">
                      <div>
                        <p className="panel-label">Room Notes</p>
                        <h2>Shared table</h2>
                      </div>
                    </div>
                    <p className="panel-caption">Players can use the chat on the right and click abilities from the sheet popup to roll dice.</p>
                  </section>
                )}
              </div>
            </WorkspaceModal>
          )}

        </>
      )}

      {banner && (
        <button
          type="button"
          className={`toast ${banner.tone}`}
          onClick={() => setBanner(null)}
          aria-label="Dismiss notification"
        >
          {banner.text}
        </button>
      )}
    </div>
  );
}

function buildRoomSocketUrl() {
  const configured = import.meta.env.VITE_WS_URL;

  if (typeof configured === "string" && configured.length > 0) {
    return configured;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}
