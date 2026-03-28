import { useState } from "react";

import { ArrowRight, Castle, Map as MapIcon, Swords, Users } from "lucide-react";

import type {
  ActorKind,
  ActorSheet,
  CampaignMap,
  CampaignSnapshot,
  MemberRole,
  MonsterTemplate
} from "@shared/types";

import { CampaignActorManager } from "../components/CampaignActorManager";
import { CampaignMapActorCreator } from "../components/CampaignMapActorCreator";
import { CampaignMapEditor } from "../components/CampaignMapEditor";
import { CampaignMapManager } from "../components/CampaignMapManager";
import { CampaignMapRoster } from "../components/CampaignMapRoster";
import { CampaignRoomManager } from "../components/CampaignRoomManager";
import { CharacterSheet } from "../components/CharacterSheet";
import { WorkspaceModal, type WorkspaceModalView } from "../components/WorkspaceModal";
import type {
  ActorTypeFilter,
  AvailableActorEntry,
  CurrentMapRosterEntry
} from "../features/campaign/types";

type ActivePopup = "sheet" | null;
type DashboardSection = "room" | "actors" | "maps";
type MapDialogState = { kind: "create" } | { kind: "edit" | "actors"; mapId: string } | null;

interface CampaignHubPageProps {
  token: string;
  campaign: CampaignSnapshot["campaign"];
  compendium: CampaignSnapshot["compendium"];
  role: MemberRole;
  currentUserId: string;
  activeMap?: CampaignMap;
  selectedMap?: CampaignMap;
  selectedActor: ActorSheet | null;
  activePopup: ActivePopup;
  editingMap: CampaignMap | null;
  mapEditorMode: "create" | "edit" | null;
  filteredCurrentMapRoster: CurrentMapRosterEntry[];
  filteredSelectedMapRoster: CurrentMapRosterEntry[];
  availableActors: AvailableActorEntry[];
  selectedMapAvailableActors: AvailableActorEntry[];
  actorSearch: string;
  actorTypeFilter: ActorTypeFilter;
  actorCreatorKind: ActorKind;
  actorCreatorOpen: boolean;
  actorDraft: ActorSheet | null;
  monsterQuery: string;
  filteredCatalog: MonsterTemplate[];
  selectedMonsterTemplate: MonsterTemplate | null;
  inviteDraft: {
    role: MemberRole;
  };
  canUndoEditingMap: boolean;
  canRedoEditingMap: boolean;
  canPersistEditingMap: boolean;
  onOpenBoard: () => void;
  onSetActivePopup: (popup: ActivePopup) => void;
  onSelectMap: (mapId: string | null) => void;
  onSelectActor: (actorId: string | null) => void;
  onRoll: (notation: string, label: string, actor?: ActorSheet | null) => Promise<void>;
  onSaveActor: (actor: ActorSheet) => Promise<void>;
  onActorSearchChange: (value: string) => void;
  onActorTypeFilterChange: (value: ActorTypeFilter) => void;
  onActorCreatorOpenChange: (open: boolean) => void;
  onActorCreatorKindChange: (kind: ActorKind) => void;
  onCreateActor: (draft: ActorSheet) => Promise<void>;
  onMonsterQueryChange: (value: string) => void;
  onSelectMonster: (monsterId: string) => void;
  onCreateMonsterActor: (monster: MonsterTemplate) => void;
  onCreateMapActor: (draft: ActorSheet, mapId: string) => Promise<void>;
  onCreateMapMonsterActor: (monster: MonsterTemplate, mapId: string) => Promise<void>;
  onAssignActorToMap: (actorId: string, mapId: string) => void;
  onRemoveActorFromMap: (actorId: string, mapId: string) => void;
  onDeleteActor: (actor: ActorSheet) => void;
  onInviteDraftChange: (draft: { role: MemberRole }) => void;
  onCreateInvite: () => void;
  onRemoveInvite: (inviteId: string) => void;
  onShowMap: (mapId: string) => void;
  onStartCreateMap: () => void;
  onStartEditMap: (map: CampaignMap) => void;
  onChangeEditingMap: (map: CampaignMap) => void;
  onSaveEditingMap: () => void;
  onReloadEditingMap: () => void;
  onUndoEditingMap: () => void;
  onRedoEditingMap: () => void;
  onSetEditingMapActive: () => void;
  onBackToMapsList: () => void;
  onMapUploadError: (message: string) => void;
}

export function CampaignHubPage({
  token,
  campaign,
  compendium,
  role,
  currentUserId,
  activeMap,
  selectedMap,
  selectedActor,
  activePopup,
  editingMap,
  mapEditorMode,
  filteredCurrentMapRoster,
  filteredSelectedMapRoster,
  availableActors,
  selectedMapAvailableActors,
  actorSearch,
  actorTypeFilter,
  actorCreatorKind,
  actorCreatorOpen,
  actorDraft,
  monsterQuery,
  filteredCatalog,
  selectedMonsterTemplate,
  inviteDraft,
  canUndoEditingMap,
  canRedoEditingMap,
  canPersistEditingMap,
  onOpenBoard,
  onSetActivePopup,
  onSelectMap,
  onSelectActor,
  onRoll,
  onSaveActor,
  onActorSearchChange,
  onActorTypeFilterChange,
  onActorCreatorOpenChange,
  onActorCreatorKindChange,
  onCreateActor,
  onMonsterQueryChange,
  onSelectMonster,
  onCreateMonsterActor,
  onCreateMapActor,
  onCreateMapMonsterActor,
  onAssignActorToMap,
  onRemoveActorFromMap,
  onDeleteActor,
  onInviteDraftChange,
  onCreateInvite,
  onRemoveInvite,
  onShowMap,
  onStartCreateMap,
  onStartEditMap,
  onChangeEditingMap,
  onSaveEditingMap,
  onReloadEditingMap,
  onUndoEditingMap,
  onRedoEditingMap,
  onSetEditingMapActive,
  onBackToMapsList,
  onMapUploadError
}: CampaignHubPageProps) {
  const [section, setSection] = useState<DashboardSection>("maps");
  const [mapDialog, setMapDialog] = useState<MapDialogState>(null);

  function closeMapDialog() {
    setMapDialog(null);
    onBackToMapsList();
  }

  function openCreateMapDialog() {
    onStartCreateMap();
    setMapDialog({ kind: "create" });
  }

  function openEditMapDialog(map: CampaignMap) {
    onSelectMap(map.id);
    onStartEditMap(map);
    setMapDialog({ kind: "edit", mapId: map.id });
  }

  function openMapActorsDialog(map: CampaignMap) {
    onSelectMap(map.id);
    setMapDialog({ kind: "actors", mapId: map.id });
  }

  function resolveDialogMap(mapId?: string) {
    if (!mapId) {
      return undefined;
    }

    const map = campaign.maps.find((entry) => entry.id === mapId);
    return map && selectedMap?.id === map.id ? selectedMap : map;
  }

  function resolveDialogRoster(mapId?: string) {
    return selectedMap?.id === mapId ? filteredSelectedMapRoster : [];
  }

  function resolveDialogAvailableActors(mapId?: string) {
    return selectedMap?.id === mapId ? selectedMapAvailableActors : [];
  }

  function buildCreateActorView(mapId: string): WorkspaceModalView {
    const map = resolveDialogMap(mapId);

    return {
      id: "map-actor-create",
      title: map ? `Create actor for ${map.name}` : "Create actor",
      size: "wide",
      data: { mapId }
    };
  }

  const mapDialogView: WorkspaceModalView | null =
    mapDialog?.kind === "create"
      ? {
          id: "map-create",
          title: "New map",
          size: "full"
        }
      : mapDialog?.kind === "edit"
        ? {
            id: "map-edit",
            title: `Edit ${resolveDialogMap(mapDialog.mapId)?.name ?? "map"}`,
            size: "full",
            data: { mapId: mapDialog.mapId }
          }
        : mapDialog?.kind === "actors"
          ? {
              id: "map-actors",
              title: `${resolveDialogMap(mapDialog.mapId)?.name ?? "Map"} actors`,
              size: "wide",
              data: { mapId: mapDialog.mapId }
            }
          : null;

  return (
    <>
      <main className="grid min-h-[max(48rem,calc(100dvh-8rem))] grid-rows-[auto_minmax(0,1fr)] gap-5 px-4 py-6 lg:px-8">
        <section className="rounded-none border border-amber-200/10 bg-slate-950/72 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-3xl">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-amber-200/55">Campaign</p>
              <h2 className="mt-2 font-serif text-3xl text-amber-50">{campaign.name}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {role === "dm"
                  ? "Manage members, actors, and maps here before opening the live board."
                  : "Manage your roster and review the active board setup here before opening the live board."}
              </p>
            </div>
            <div className="flex flex-col items-stretch gap-3 sm:min-w-64">
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-none border border-amber-200/20 bg-amber-300/18 px-4 text-sm font-semibold text-amber-50 transition hover:bg-amber-300/24"
                onClick={onOpenBoard}
              >
                <span>Open Board</span>
                <ArrowRight size={16} />
              </button>
              <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-3">
                <div className="rounded-none border border-white/10 bg-white/[0.04] px-3 py-3">
                  <div className="flex items-center gap-2 text-amber-100">
                    <MapIcon size={14} />
                    <span>Board</span>
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                    {activeMap?.name ?? "No active map"}
                  </p>
                </div>
                <div className="rounded-none border border-white/10 bg-white/[0.04] px-3 py-3">
                  <div className="flex items-center gap-2 text-amber-100">
                    <Users size={14} />
                    <span>Role</span>
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">{role}</p>
                </div>
                <div className="rounded-none border border-white/10 bg-white/[0.04] px-3 py-3">
                  <div className="flex items-center gap-2 text-amber-100">
                    <Swords size={14} />
                    <span>Roster</span>
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                    {availableActors.length} managed
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="dark-card campaign-dashboard-shell">
          <div className="admin-page-toolbar">
            <div className="segmented admin-tabbar">
              <button type="button" className={section === "room" ? "is-active" : ""} onClick={() => setSection("room")}>
                <Castle size={15} />
                <span>Members and access</span>
                <span className="badge subtle">{campaign.members.length}</span>
              </button>
              <button type="button" className={section === "actors" ? "is-active" : ""} onClick={() => setSection("actors")}>
                <Users size={15} />
                <span>Actors</span>
                <span className="badge subtle">{availableActors.length}</span>
              </button>
              <button type="button" className={section === "maps" ? "is-active" : ""} onClick={() => setSection("maps")}>
                <MapIcon size={15} />
                <span>{role === "dm" ? "Maps" : "Board actors"}</span>
                <span className="badge subtle">{role === "dm" ? campaign.maps.length : filteredCurrentMapRoster.length}</span>
              </button>
            </div>
          </div>
          <div className="campaign-dashboard-content">
            {section === "room" && (
              <CampaignRoomManager
                campaign={campaign}
                role={role}
                inviteDraft={inviteDraft}
                onInviteDraftChange={onInviteDraftChange}
                onCreateInvite={onCreateInvite}
                onRemoveInvite={onRemoveInvite}
              />
            )}

            {section === "actors" && (
              <CampaignActorManager
                token={token}
                role={role}
                currentUserId={currentUserId}
                campaignMaps={campaign.maps}
                campaignMembers={campaign.members}
                compendium={compendium}
                selectedActor={selectedActor}
                availableActors={availableActors}
                actorSearch={actorSearch}
                actorTypeFilter={actorTypeFilter}
                actorCreatorKind={actorCreatorKind}
                actorCreatorOpen={actorCreatorOpen}
                actorDraft={actorDraft}
                monsterQuery={monsterQuery}
                filteredCatalog={filteredCatalog}
                selectedMonsterTemplate={selectedMonsterTemplate}
                onOpenSheet={(actorId) => {
                  onSelectActor(actorId);
                  onSetActivePopup("sheet");
                }}
                onRoll={onRoll}
                onActorSearchChange={onActorSearchChange}
                onActorTypeFilterChange={onActorTypeFilterChange}
                onActorCreatorOpenChange={onActorCreatorOpenChange}
                onActorCreatorKindChange={onActorCreatorKindChange}
                onCreateActor={onCreateActor}
                onMonsterQueryChange={onMonsterQueryChange}
                onSelectMonster={onSelectMonster}
                onCreateMonsterActor={onCreateMonsterActor}
                onDeleteActor={onDeleteActor}
              />
            )}

            {section === "maps" &&
              (role === "dm" ? (
                <CampaignMapManager
                  campaignMaps={campaign.maps}
                  role={role}
                  activeMap={activeMap}
                  onShowMap={onShowMap}
                  onStartCreateMap={openCreateMapDialog}
                  onStartEditMap={openEditMapDialog}
                  onOpenActors={openMapActorsDialog}
                />
              ) : (
                <CampaignMapRoster
                  role={role}
                  currentUserId={currentUserId}
                  selectedMap={activeMap}
                  selectedActor={selectedActor}
                  roster={filteredCurrentMapRoster}
                  onOpenSheet={(actorId) => {
                    onSelectActor(actorId);
                    onSetActivePopup("sheet");
                  }}
                  onRemoveActorFromCurrentMap={onRemoveActorFromMap}
                />
              ))}
          </div>
        </section>
      </main>

      {mapDialogView ? (
        <WorkspaceModal initialView={mapDialogView} onClose={closeMapDialog}>
          {({ currentView, pushView }) => {
            const currentMapId = (currentView.data as { mapId?: string } | undefined)?.mapId;
            const currentMap = resolveDialogMap(currentMapId);

            if (currentView.id === "map-create" || currentView.id === "map-edit") {
              return (
                <CampaignMapEditor
                  token={token}
                  role={role}
                  activeMap={activeMap}
                  editingMap={editingMap}
                  mapEditorMode={mapEditorMode}
                  canUndoEditingMap={canUndoEditingMap}
                  canRedoEditingMap={canRedoEditingMap}
                  canPersistEditingMap={canPersistEditingMap}
                  onChangeEditingMap={onChangeEditingMap}
                  onSaveEditingMap={onSaveEditingMap}
                  onReloadEditingMap={onReloadEditingMap}
                  onUndoEditingMap={onUndoEditingMap}
                  onRedoEditingMap={onRedoEditingMap}
                  onSetEditingMapActive={onSetEditingMapActive}
                  onMapUploadError={onMapUploadError}
                />
              );
            }

            if (currentView.id === "map-actors") {
              return (
                <CampaignMapRoster
                  role={role}
                  currentUserId={currentUserId}
                  selectedMap={currentMap}
                  selectedActor={selectedActor}
                  roster={resolveDialogRoster(currentMapId)}
                  onOpenSheet={(actorId) => {
                    onSelectActor(actorId);
                    onSetActivePopup("sheet");
                  }}
                  onRemoveActorFromCurrentMap={onRemoveActorFromMap}
                  onOpenAddFlow={currentMap ? () => pushView(buildCreateActorView(currentMap.id)) : undefined}
                />
              );
            }

            if (currentView.id === "map-actor-create") {
              return (
                <CampaignMapActorCreator
                  currentUserId={currentUserId}
                  selectedMap={currentMap}
                  actorCreatorKind={actorCreatorKind}
                  availableActors={resolveDialogAvailableActors(currentMapId)}
                  filteredCatalog={filteredCatalog}
                  selectedMonsterTemplate={selectedMonsterTemplate}
                  onActorCreatorKindChange={onActorCreatorKindChange}
                  onCreateActor={onCreateMapActor}
                  onMonsterQueryChange={onMonsterQueryChange}
                  onSelectMonster={onSelectMonster}
                  onCreateMonsterActor={onCreateMapMonsterActor}
                  onAssignActorToCurrentMap={onAssignActorToMap}
                  onOpenSheet={(actorId) => {
                    onSelectActor(actorId);
                    onSetActivePopup("sheet");
                  }}
                />
              );
            }

            return null;
          }}
        </WorkspaceModal>
      ) : null}

      {activePopup === "sheet" && (
        <WorkspaceModal
          title={selectedActor ? `${selectedActor.name} Sheet` : "Interactive Sheet"}
          size="wide"
          onClose={() => onSetActivePopup(null)}
        >
          <CharacterSheet
            token={token}
            actor={selectedActor ?? undefined}
            compendium={compendium}
            role={role}
            currentUserId={currentUserId}
            onSave={onSaveActor}
            onRoll={onRoll}
          />
        </WorkspaceModal>
      )}
    </>
  );
}
