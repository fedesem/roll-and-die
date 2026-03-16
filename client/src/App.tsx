import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";

import type {
  ActorKind,
  ActorSheet,
  AuthPayload,
  CampaignMap,
  CampaignSnapshot,
  CampaignSummary,
  ClientRoomMessage,
  MemberRole,
  ServerRoomMessage
} from "@shared/types";

import { apiRequest } from "./api";
import { BoardCanvas } from "./components/BoardCanvas";
import { CharacterSheet } from "./components/CharacterSheet";
import { ChatPanel } from "./components/ChatPanel";
import { MapConfigurator } from "./components/MapConfigurator";

const sessionStorageKey = "dnd-board-session";
const selectedCampaignStorageKey = "dnd-board-selected-campaign";

type AuthMode = "login" | "register";

interface BannerState {
  tone: "info" | "error";
  text: string;
}

export default function App() {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [session, setSession] = useState<AuthPayload | null>(() => readJson<AuthPayload>(sessionStorageKey));
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(() =>
    readJson<string>(selectedCampaignStorageKey)
  );
  const [snapshot, setSnapshot] = useState<CampaignSnapshot | null>(null);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [createCampaignName, setCreateCampaignName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [actorDraft, setActorDraft] = useState({ name: "", kind: "character" as ActorKind });
  const [inviteDraft, setInviteDraft] = useState({ label: "Open seat", role: "player" as MemberRole });
  const [monsterQuery, setMonsterQuery] = useState("");
  const [mapDraft, setMapDraft] = useState<CampaignMap | null>(null);
  const [newMapDraft, setNewMapDraft] = useState<CampaignMap>(() => createClientMapDraft());
  const [mapEditorMode, setMapEditorMode] = useState<"create" | "edit">("edit");
  const [dmFogEnabled, setDmFogEnabled] = useState(false);
  const [dmFogUserId, setDmFogUserId] = useState<string | null>(null);
  const [activePopup, setActivePopup] = useState<"sheet" | "actors" | "maps" | "room" | "monsters" | null>(null);
  const [roomStatus, setRoomStatus] = useState<"offline" | "connecting" | "online">("offline");
  const roomSocketRef = useRef<WebSocket | null>(null);

  const deferredMonsterQuery = useDeferredValue(monsterQuery);

  useEffect(() => {
    writeJson(sessionStorageKey, session);
  }, [session]);

  useEffect(() => {
    writeJson(selectedCampaignStorageKey, selectedCampaignId);
  }, [selectedCampaignId]);

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
    if (!session || !selectedCampaignId) {
      if (roomSocketRef.current) {
        roomSocketRef.current.close();
        roomSocketRef.current = null;
      }

      setRoomStatus("offline");
      setSnapshot(null);
      return;
    }

    setSnapshot(null);
    setRoomStatus("connecting");
    const socket = new WebSocket(buildRoomSocketUrl());
    roomSocketRef.current = socket;
    let disposed = false;

    const handleOpen = () => {
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

    socket.addEventListener("open", handleOpen);
    socket.addEventListener("message", handleMessage);
    socket.addEventListener("close", handleClose);
    socket.addEventListener("error", handleError);

    return () => {
      disposed = true;
      socket.removeEventListener("open", handleOpen);
      socket.removeEventListener("message", handleMessage);
      socket.removeEventListener("close", handleClose);
      socket.removeEventListener("error", handleError);

      if (roomSocketRef.current === socket) {
        roomSocketRef.current = null;
      }

      if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
        socket.close();
      }

      setRoomStatus("offline");
    };
  }, [selectedCampaignId, session?.token]);

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
    () => campaign?.actors.find((entry) => entry.id === selectedActorId) ?? campaign?.actors[0],
    [campaign?.actors, selectedActorId]
  );
  const selectedActorOnMap = useMemo(
    () =>
      Boolean(
        selectedActor &&
          activeMap &&
          campaign?.tokens.some((token) => token.actorId === selectedActor.id && token.mapId === activeMap.id)
      ),
    [activeMap, campaign?.tokens, selectedActor]
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

  useEffect(() => {
    if (!campaign) {
      setSelectedMapId(null);
      setSelectedActorId(null);
      setMapDraft(null);
      setNewMapDraft(createClientMapDraft());
      setMapEditorMode("edit");
      setDmFogEnabled(false);
      setDmFogUserId(null);
      setActivePopup(null);
      return;
    }

    if (!selectedMapId || !campaign.maps.some((entry) => entry.id === selectedMapId)) {
      setSelectedMapId(campaign.activeMapId || campaign.maps[0]?.id || null);
    }

    if (!selectedActorId || !campaign.actors.some((entry) => entry.id === selectedActorId)) {
      setSelectedActorId(campaign.actors[0]?.id ?? null);
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

  const editingMap = mapEditorMode === "create" ? newMapDraft : mapDraft;
  const fogPreviewUserId = role === "dm" && dmFogEnabled ? dmFogUserId ?? undefined : undefined;
  const fogPreviewMember = playerMembers.find((member) => member.userId === fogPreviewUserId);
  const boardSeenCells = activeMap
    ? role === "dm"
      ? fogPreviewUserId
        ? campaign?.exploration[fogPreviewUserId]?.[activeMap.id] ?? []
        : []
      : snapshot?.playerVision[activeMap.id] ?? []
    : [];

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

  async function createActor() {
    if (!session || !selectedCampaignId || !actorDraft.name.trim()) {
      return;
    }

    try {
      const created = await apiRequest<ActorSheet>(`/campaigns/${selectedCampaignId}/actors`, {
        method: "POST",
        token: session.token,
        body: {
          name: actorDraft.name.trim(),
          kind: actorDraft.kind
        }
      });

      setActorDraft({ ...actorDraft, name: "" });
      setSelectedActorId(created.id);
      setActivePopup("sheet");
      setBanner({ tone: "info", text: `${created.name} added.` });
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

  async function addMonster(templateId: string) {
    if (!session || !selectedCampaignId) {
      return;
    }

    try {
      const created = await apiRequest<ActorSheet>(`/campaigns/${selectedCampaignId}/monsters`, {
        method: "POST",
        token: session.token,
        body: { templateId }
      });

      setSelectedActorId(created.id);
      setBanner({ tone: "info", text: `${created.name} added from the monster list.` });
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

      setNewMapDraft(createClientMapDraft());
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

          {banner && <div className={`banner ${banner.tone}`}>{banner.text}</div>}
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
        {campaign && (
          <div className="topbar-room-status">
            <span className="status-chip status-title">{campaign.name}</span>
            <span className="status-chip">{activeMap?.name ?? "No map"}</span>
            <span className="status-chip">{role.toUpperCase()}</span>
            <span className={`status-chip status-${roomStatus}`}>{roomStatus}</span>
          </div>
        )}
        <div className="topbar-actions">
          <button type="button" onClick={() => setSelectedCampaignId(null)}>
            Campaigns
          </button>
          <button type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {banner && <div className={`banner ${banner.tone}`}>{banner.text}</div>}

      {!selectedCampaignId ? (
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
      ) : !snapshot ? (
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
                onSelectActor={setSelectedActorId}
                onMoveActor={moveActor}
                onToggleDoor={toggleDoor}
                onUpdateMap={saveMap}
              />

              <aside className="table-overlay table-menu">
                <section className="overlay-card overlay-nav">
                  <p className="panel-label">Menu</p>
                  <div className="overlay-nav-buttons">
                    <button type="button" onClick={() => setActivePopup("actors")}>
                      Actors
                    </button>
                    <button type="button" onClick={() => setActivePopup("maps")}>
                      Maps
                    </button>
                    <button type="button" disabled={!selectedActor} onClick={() => setActivePopup("sheet")}>
                      Sheet
                    </button>
                    {role === "dm" && (
                      <button type="button" onClick={() => setActivePopup("monsters")}>
                        Monsters
                      </button>
                    )}
                    <button type="button" onClick={() => setActivePopup("room")}>
                      Room
                    </button>
                  </div>
                </section>

                <section className="overlay-card overlay-selection">
                  <div className="overlay-selection-head">
                    <div className="selected-actor-dot" style={{ background: selectedActor?.color ?? "#5d6470" }} />
                    <div>
                      <p className="panel-label">Selected</p>
                      <h3>{selectedActor?.name ?? "No actor selected"}</h3>
                    </div>
                  </div>
                  <p className="overlay-selection-meta">
                    {selectedActor ? `${selectedActor.kind}${selectedActorOnMap ? " • on map" : " • ready to place"}` : "Open Actors to pick a character, NPC, or monster."}
                  </p>
                  {selectedActor && (
                    <button className="accent-button" type="button" onClick={() => setActivePopup("sheet")}>
                      Open Sheet
                    </button>
                  )}
                </section>

                {role === "dm" && playerMembers.length > 0 && (
                  <section className="overlay-card overlay-fog-tools">
                    <p className="panel-label">Fog</p>
                    <div className="stack-form compact">
                      <label>
                        Player
                        <select
                          value={dmFogUserId ?? ""}
                          onChange={(event) => setDmFogUserId(event.target.value || null)}
                        >
                          {playerMembers.map((member) => (
                            <option key={member.userId} value={member.userId}>
                              {member.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={dmFogEnabled && Boolean(dmFogUserId)}
                          disabled={!dmFogUserId}
                          onChange={(event) => setDmFogEnabled(event.target.checked)}
                        />
                        View Fog
                      </label>
                      {fogPreviewMember && dmFogEnabled && (
                        <span className="badge subtle">Viewing {fogPreviewMember.name}</span>
                      )}
                      <button type="button" onClick={() => void resetFog()} disabled={!activeMap}>
                        Reset Fog
                      </button>
                    </div>
                  </section>
                )}
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
            <WorkspaceModal title="Actors" onClose={() => setActivePopup(null)}>
              <div className="popup-grid two-columns">
                <section className="dark-card popup-card">
                  <div className="panel-head">
                    <div>
                      <p className="panel-label">Roster</p>
                      <h2>Characters, NPCs, monsters</h2>
                    </div>
                  </div>
                  <div className="list-stack">
                    {campaign.actors.map((actor) => {
                      const onMap = campaign.tokens.some(
                        (token) => token.actorId === actor.id && token.mapId === activeMap?.id
                      );

                      return (
                        <div key={actor.id} className="popup-row">
                          <button
                            className={`list-row ${selectedActor?.id === actor.id ? "is-selected" : ""}`}
                            type="button"
                            onClick={() => {
                              setSelectedActorId(actor.id);
                              setActivePopup(null);
                            }}
                          >
                            <span>{actor.name}</span>
                            <small>
                              {actor.kind}
                              {onMap ? " • on map" : ""}
                            </small>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedActorId(actor.id);
                              setActivePopup("sheet");
                            }}
                          >
                            Sheet
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="dark-card popup-card">
                  <div className="panel-head">
                    <div>
                      <p className="panel-label">Create</p>
                      <h2>Add actor</h2>
                    </div>
                  </div>
                  <div className="stack-form">
                    <input
                      placeholder="New actor name"
                      value={actorDraft.name}
                      onChange={(event) => setActorDraft({ ...actorDraft, name: event.target.value })}
                    />
                    <div className="inline-form compact">
                      <select
                        value={actorDraft.kind}
                        onChange={(event) => setActorDraft({ ...actorDraft, kind: event.target.value as ActorKind })}
                      >
                        <option value="character">Character</option>
                        {role === "dm" && <option value="npc">NPC</option>}
                      </select>
                      <button type="button" onClick={() => void createActor()}>
                        Add
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            </WorkspaceModal>
          )}

          {activePopup === "maps" && (
            <WorkspaceModal title="Maps" size="full" onClose={() => setActivePopup(null)}>
              <div className="maps-popup">
                <section className="dark-card popup-card maps-list-card">
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
                          <button
                            className={`list-row ${selectedMap?.id === map.id ? "is-selected" : ""}`}
                            type="button"
                            onClick={() => {
                              setSelectedMapId(map.id);
                              setMapEditorMode("edit");
                            }}
                          >
                            <span>{map.name}</span>
                            <small>
                              {map.id === activeMap?.id ? "Active board" : "Standby map"} • {map.width}×{map.height}
                            </small>
                          </button>
                          {role === "dm" && map.id !== activeMap?.id && (
                            <button
                              type="button"
                              onClick={() => {
                                void sendRoomMessage({ type: "map:set-active", mapId: map.id }).catch((error: unknown) => {
                                  setBanner({ tone: "error", text: toErrorMessage(error) });
                                });
                              }}
                            >
                              Show
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
                      onClick={() => setMapEditorMode("create")}
                    >
                      New Map Draft
                    </button>
                  )}
                </section>

                <section className="dark-card popup-card maps-editor-card">
                  <div className="panel-head">
                    <div>
                      <p className="panel-label">Settings</p>
                      <h2>
                        {mapEditorMode === "create" ? "New map draft" : selectedMap?.name ?? "Map details"}
                      </h2>
                    </div>
                  </div>
                  {editingMap ? (
                    <>
                      {role === "dm" && mapEditorMode === "edit" && mapDraft && (
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
                      <MapConfigurator
                        map={editingMap}
                        disabled={role !== "dm"}
                        onChange={mapEditorMode === "create" ? setNewMapDraft : (nextMap) => setMapDraft(nextMap)}
                        onUploadError={(message) => setBanner({ tone: "error", text: message })}
                      />
                      {role === "dm" && (
                        <div className="inline-form compact">
                          {mapEditorMode === "create" ? (
                            <>
                              <button type="button" onClick={() => setNewMapDraft(createClientMapDraft())}>
                                Reset Draft
                              </button>
                              <button className="accent-button" type="button" onClick={() => void createMap(newMapDraft)}>
                                Create Map
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
                                  Reset to Saved
                                </button>
                                <button className="accent-button" type="button" onClick={() => void saveMap(mapDraft)}>
                                  Save Map
                                </button>
                              </>
                            )
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="empty-state">Select a map to edit its settings.</p>
                  )}
                </section>
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

          {activePopup === "monsters" && role === "dm" && (
            <WorkspaceModal title="Monster List" onClose={() => setActivePopup(null)}>
              <section className="dark-card popup-card">
                <div className="panel-head">
                  <div>
                    <p className="panel-label">Bestiary</p>
                    <h2>Monster list</h2>
                  </div>
                </div>
                <input
                  placeholder="Search monsters"
                  value={monsterQuery}
                  onChange={(event) => setMonsterQuery(event.target.value)}
                />
                <div className="monster-list">
                  {filteredCatalog.map((monster) => (
                    <button key={monster.id} className="monster-card" type="button" onClick={() => void addMonster(monster.id)}>
                      <span>{monster.name}</span>
                      <small>
                        CR {monster.challengeRating} • AC {monster.armorClass} • HP {monster.hitPoints}
                      </small>
                    </button>
                  ))}
                </div>
              </section>
            </WorkspaceModal>
          )}
        </>
      )}
    </div>
  );
}

function readJson<T>(key: string) {
  const raw = window.localStorage.getItem(key);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (value === null || value === undefined) {
    window.localStorage.removeItem(key);
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error.";
}

function buildRoomSocketUrl() {
  const configured = import.meta.env.VITE_WS_URL;

  if (typeof configured === "string" && configured.length > 0) {
    return configured;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

function cloneMap(map: CampaignMap) {
  return JSON.parse(JSON.stringify(map)) as CampaignMap;
}

function createClientMapDraft(name = "Encounter Map"): CampaignMap {
  return {
    id: `draft_${crypto.randomUUID().slice(0, 8)}`,
    name,
    backgroundUrl: "",
    backgroundOffsetX: 0,
    backgroundOffsetY: 0,
    backgroundScale: 1,
    width: 1600,
    height: 1200,
    grid: {
      show: true,
      cellSize: 70,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      color: "rgba(220, 182, 92, 0.5)"
    },
    walls: [],
    drawings: [],
    fog: [],
    visibilityVersion: 1
  };
}

interface WorkspaceModalProps {
  title: string;
  onClose: () => void;
  size?: "default" | "wide" | "full";
  children: ReactNode;
}

function WorkspaceModal({ title, onClose, size = "default", children }: WorkspaceModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className={`modal-card ${size !== "default" ? size : ""}`}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="modal-head">
          <div>
            <p className="panel-label">Popup</p>
            <h2>{title}</h2>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}
