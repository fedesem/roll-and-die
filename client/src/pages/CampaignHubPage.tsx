import { useEffect, useState } from "react";

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
import { CampaignMapAssignments } from "../components/CampaignMapAssignments";
import { CampaignMapManager } from "../components/CampaignMapManager";
import { CampaignRoomManager } from "../components/CampaignRoomManager";
import { CharacterSheet } from "../components/CharacterSheet";
import { WorkspaceModal } from "../components/WorkspaceModal";
import type {
  ActorTypeFilter,
  AvailableActorEntry,
  CurrentMapRosterEntry
} from "../features/campaign/types";

type ActivePopup = "sheet" | null;
type DashboardSection = "room" | "actors" | "maps";

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
  availableActors: AvailableActorEntry[];
  actorSearch: string;
  mapActorSearch: string;
  actorTypeFilter: ActorTypeFilter;
  mapActorTypeFilter: ActorTypeFilter;
  actorCreatorKind: ActorKind;
  actorCreatorOpen: boolean;
  actorDraft: ActorSheet | null;
  monsterQuery: string;
  filteredCatalog: MonsterTemplate[];
  selectedMonsterTemplate: MonsterTemplate | null;
  inviteDraft: {
    label: string;
    role: MemberRole;
  };
  canUndoEditingMap: boolean;
  canRedoEditingMap: boolean;
  canPersistEditingMap: boolean;
  onOpenBoard: () => void;
  onSetActivePopup: (popup: ActivePopup) => void;
  onSelectActor: (actorId: string | null) => void;
  onRoll: (notation: string, label: string, actor?: ActorSheet | null) => Promise<void>;
  onSaveActor: (actor: ActorSheet) => Promise<void>;
  onActorSearchChange: (value: string) => void;
  onMapActorSearchChange: (value: string) => void;
  onActorTypeFilterChange: (value: ActorTypeFilter) => void;
  onMapActorTypeFilterChange: (value: ActorTypeFilter) => void;
  onActorCreatorOpenChange: (open: boolean) => void;
  onActorCreatorKindChange: (kind: ActorKind) => void;
  onCreateActor: (draft: ActorSheet) => Promise<void>;
  onMonsterQueryChange: (value: string) => void;
  onSelectMonster: (monsterId: string) => void;
  onCreateMonsterActor: (monster: MonsterTemplate) => void;
  onAssignActorToCurrentMap: (actorId: string) => void;
  onRemoveActorFromCurrentMap: (actorId: string) => void;
  onDeleteActor: (actor: ActorSheet) => void;
  onInviteDraftChange: (draft: { label: string; role: MemberRole }) => void;
  onCreateInvite: () => void;
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
  availableActors,
  actorSearch,
  mapActorSearch,
  actorTypeFilter,
  mapActorTypeFilter,
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
  onSelectActor,
  onRoll,
  onSaveActor,
  onActorSearchChange,
  onMapActorSearchChange,
  onActorTypeFilterChange,
  onMapActorTypeFilterChange,
  onActorCreatorOpenChange,
  onActorCreatorKindChange,
  onCreateActor,
  onMonsterQueryChange,
  onSelectMonster,
  onCreateMonsterActor,
  onAssignActorToCurrentMap,
  onRemoveActorFromCurrentMap,
  onDeleteActor,
  onInviteDraftChange,
  onCreateInvite,
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
  const [section, setSection] = useState<DashboardSection>("room");

  useEffect(() => {
    if (role !== "dm" && section === "maps") {
      setSection("room");
    }
  }, [role, section]);

  return (
    <>
      <main className="grid gap-5 px-4 py-6 lg:px-8">
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
              {role === "dm" && (
                <button type="button" className={section === "maps" ? "is-active" : ""} onClick={() => setSection("maps")}>
                  <MapIcon size={15} />
                  <span>Maps</span>
                  <span className="badge subtle">{campaign.maps.length}</span>
                </button>
              )}
            </div>
          </div>

          {section === "room" && (
            <CampaignRoomManager
              campaign={campaign}
              role={role}
              inviteDraft={inviteDraft}
              onInviteDraftChange={onInviteDraftChange}
              onCreateInvite={onCreateInvite}
            />
          )}

          {section === "actors" && (
              <CampaignActorManager
                token={token}
                role={role}
                currentUserId={currentUserId}
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

          {role === "dm" && section === "maps" && (
            <div className={`campaign-maps-grid${editingMap ? " is-editing" : ""}`}>
              <CampaignMapManager
                token={token}
                campaignMaps={campaign.maps}
                role={role}
                activeMap={activeMap}
                selectedMap={selectedMap}
                editingMap={editingMap}
                mapEditorMode={mapEditorMode}
                onShowMap={onShowMap}
                onStartCreateMap={onStartCreateMap}
                onStartEditMap={onStartEditMap}
                onChangeEditingMap={onChangeEditingMap}
                onSaveEditingMap={onSaveEditingMap}
                onReloadEditingMap={onReloadEditingMap}
                onUndoEditingMap={onUndoEditingMap}
                onRedoEditingMap={onRedoEditingMap}
                canUndoEditingMap={canUndoEditingMap}
                canRedoEditingMap={canRedoEditingMap}
                canPersistEditingMap={canPersistEditingMap}
                onSetEditingMapActive={onSetEditingMapActive}
                onBackToMapsList={onBackToMapsList}
                onMapUploadError={onMapUploadError}
              />

              <CampaignMapAssignments
                role={role}
                currentUserId={currentUserId}
                activeMap={activeMap}
                selectedActor={selectedActor}
                filteredCurrentMapRoster={filteredCurrentMapRoster}
                availableActors={availableActors}
                actorSearch={actorSearch}
                mapActorSearch={mapActorSearch}
                actorTypeFilter={actorTypeFilter}
                mapActorTypeFilter={mapActorTypeFilter}
                onOpenSheet={(actorId) => {
                  onSelectActor(actorId);
                  onSetActivePopup("sheet");
                }}
                onActorSearchChange={onActorSearchChange}
                onMapActorSearchChange={onMapActorSearchChange}
                onActorTypeFilterChange={onActorTypeFilterChange}
                onMapActorTypeFilterChange={onMapActorTypeFilterChange}
                onAssignActorToCurrentMap={onAssignActorToCurrentMap}
                onRemoveActorFromCurrentMap={onRemoveActorFromCurrentMap}
              />
            </div>
          )}
        </section>
      </main>

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
