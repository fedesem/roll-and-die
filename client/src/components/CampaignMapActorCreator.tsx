import { useState } from "react";
import { FilePlus2, Plus, ScrollText } from "lucide-react";

import type { ActorKind, ActorSheet, CampaignMap, CampaignSnapshot, MonsterTemplate } from "@shared/types";

import type { ActorTypeFilter, AvailableActorEntry } from "../features/campaign/types";
import { createClientActorDraft } from "../lib/drafts";
import { CampaignActionButton } from "./CampaignActionButton";
import { RulesText } from "./admin/AdminPreview";
import { ViewportWorkspace, WorkspacePane, WorkspacePaneBody } from "./layout/ViewportWorkspace";
import { MonsterCatalogOption, MonsterStatBlock } from "./monster/MonsterStatBlock";

interface CampaignMapActorCreatorProps {
  currentUserId: string;
  selectedMap?: CampaignMap;
  compendium: CampaignSnapshot["compendium"];
  actorCreatorKind: ActorKind;
  availableActors: AvailableActorEntry[];
  filteredCatalog: MonsterTemplate[];
  selectedMonsterTemplate: MonsterTemplate | null;
  onActorCreatorKindChange: (value: ActorKind) => void;
  onCreateActor: (draft: ActorSheet, mapId: string) => Promise<void>;
  onMonsterQueryChange: (value: string) => void;
  onSelectMonster: (monsterId: string) => void;
  onCreateMonsterActor: (monster: MonsterTemplate, mapId: string) => Promise<void>;
  onAssignActorToCurrentMap: (actorId: string, mapId: string) => void;
  onOpenSheet?: (actorId: string) => void;
}

export function CampaignMapActorCreator({
  currentUserId,
  selectedMap,
  compendium,
  actorCreatorKind,
  availableActors,
  filteredCatalog,
  selectedMonsterTemplate,
  onActorCreatorKindChange,
  onCreateActor,
  onMonsterQueryChange,
  onSelectMonster,
  onCreateMonsterActor,
  onAssignActorToCurrentMap,
  onOpenSheet
}: CampaignMapActorCreatorProps) {
  const [newActorName, setNewActorName] = useState("");
  const [existingSearch, setExistingSearch] = useState("");
  const [existingTypeFilter, setExistingTypeFilter] = useState<ActorTypeFilter>("all");

  const reusableActors = availableActors.filter(({ actor, activeMaps, onCurrentMap, isOnAllMaps }) => {
    if (!selectedMap || onCurrentMap || isOnAllMaps) {
      return false;
    }

    if (existingTypeFilter !== "all" && actor.kind !== existingTypeFilter) {
      return false;
    }

    if (activeMaps.length === 0 || !activeMaps.some((map) => map.id !== selectedMap.id)) {
      return false;
    }

    const normalizedQuery = existingSearch.trim().toLowerCase();
    if (!normalizedQuery) {
      return true;
    }

    return [actor.name, actor.kind, actor.species, actor.className].some((value) => value.toLowerCase().includes(normalizedQuery));
  });

  async function handleCreateActor() {
    if (!selectedMap || !newActorName.trim()) {
      return;
    }

    const draft = createClientActorDraft(actorCreatorKind, currentUserId);
    draft.name = newActorName.trim();
    draft.kind = actorCreatorKind;
    await onCreateActor(draft, selectedMap.id);
    setNewActorName("");
  }

  if (!selectedMap) {
    return <p className="empty-state">Choose a map before creating actors.</p>;
  }

  return (
    <div className="stack-form actor-creation-modal min-h-0 h-full">
      <div className="inline-form compact">
        <select value={actorCreatorKind} onChange={(event) => onActorCreatorKindChange(event.target.value as ActorKind)}>
          <option value="character">Character</option>
          <option value="monster">Monster</option>
          <option value="npc">NPC</option>
          <option value="static">Static</option>
        </select>
      </div>
      {actorCreatorKind === "monster" ? (
        <ViewportWorkspace
          columns="minmax(380px, 500px) minmax(0, 1fr)"
          stackBreakpoint="1100"
          heightMode="fill"
          workspaceMinHeight="32rem"
          className="monster-browser-workspace min-h-0"
        >
          <WorkspacePane as="section" className="sheet-panel monster-browser-list-panel">
            <input placeholder="Search monsters" onChange={(event) => onMonsterQueryChange(event.target.value)} />
            <WorkspacePaneBody className="actor-list-scroll actor-creation-results" contentClassName="list-stack">
              {filteredCatalog.map((monster) => (
                <div key={monster.id} className="popup-row actor-popup-row">
                  <MonsterCatalogOption
                    monster={monster}
                    selected={selectedMonsterTemplate?.id === monster.id}
                    onSelect={() => onSelectMonster(monster.id)}
                  />
                  <div className="actor-list-actions">
                    <CampaignActionButton
                      onClick={() => void onCreateMonsterActor(monster, selectedMap.id)}
                      title="Create actor from monster"
                      aria-label="Create actor from monster"
                      icon={Plus}
                      tone="accent"
                    />
                  </div>
                </div>
              ))}
              {filteredCatalog.length === 0 ? <p className="empty-state">No monsters match that search.</p> : null}
            </WorkspacePaneBody>
          </WorkspacePane>
          <WorkspacePane as="section" className="sheet-panel monster-browser-preview-panel">
            <WorkspacePaneBody className="monster-browser-preview-scroll" fill>
              {selectedMonsterTemplate ? (
                <MonsterStatBlock
                  monster={selectedMonsterTemplate}
                  eyebrow="Preview"
                  renderText={(text) => (
                    <RulesText
                      text={text}
                      spellEntries={compendium.spells}
                      featEntries={compendium.feats}
                      classEntries={compendium.classes}
                      variantRuleEntries={compendium.variantRules}
                      conditionEntries={compendium.conditions}
                    />
                  )}
                  action={
                    <CampaignActionButton
                      onClick={() => void onCreateMonsterActor(selectedMonsterTemplate, selectedMap.id)}
                      icon={FilePlus2}
                      tone="accent"
                    >
                      Create on map
                    </CampaignActionButton>
                  }
                />
              ) : (
                <p className="empty-state">Select a monster to preview its stat block.</p>
              )}
            </WorkspacePaneBody>
          </WorkspacePane>
        </ViewportWorkspace>
      ) : (
        <div className="inline-form compact">
          <input placeholder="Actor name" value={newActorName} onChange={(event) => setNewActorName(event.target.value)} />
          <CampaignActionButton disabled={!newActorName.trim()} onClick={() => void handleCreateActor()} icon={FilePlus2} tone="accent">
            Create on map
          </CampaignActionButton>
        </div>
      )}

      <section className="popup-card actor-list-card">
        <div className="panel-head">
          <div>
            <p className="panel-label">Select</p>
            <h2>{selectedMap.name} reusable actors</h2>
          </div>
          <span className="badge subtle">{reusableActors.length}</span>
        </div>
        <div className="actor-filter-row">
          <input placeholder="Search existing actors" value={existingSearch} onChange={(event) => setExistingSearch(event.target.value)} />
          <select value={existingTypeFilter} onChange={(event) => setExistingTypeFilter(event.target.value as ActorTypeFilter)}>
            <option value="all">All types</option>
            <option value="character">Characters</option>
            <option value="npc">NPCs</option>
            <option value="monster">Monsters</option>
            <option value="static">Static</option>
          </select>
        </div>
        <div className="actor-list-scroll actor-creation-results">
          <div className="list-stack">
            {reusableActors.map(({ actor, activeMaps, ownerName }) => (
              <div key={actor.id} className="popup-row actor-popup-row">
                <div className="list-row actor-list-row-static">
                  <div className="actor-row-main">
                    <span className="actor-row-name">{actor.name}</span>
                    <div className="actor-row-meta">
                      <span className="badge subtle actor-owner-badge" title={ownerName}>
                        {ownerName}
                      </span>
                      {activeMaps
                        .filter((map) => map.id !== selectedMap.id)
                        .map((map) => (
                          <span key={map.id} className="badge map-badge">
                            {map.name}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
                <div className="actor-list-actions">
                  {onOpenSheet ? (
                    <CampaignActionButton
                      title="Open sheet"
                      aria-label="Open sheet"
                      onClick={() => onOpenSheet(actor.id)}
                      icon={ScrollText}
                    />
                  ) : null}
                  <CampaignActionButton
                    title="Add existing actor to selected map"
                    aria-label="Add existing actor to selected map"
                    onClick={() => onAssignActorToCurrentMap(actor.id, selectedMap.id)}
                    icon={Plus}
                  />
                </div>
              </div>
            ))}
            {reusableActors.length === 0 ? <p className="empty-state">No actors from other maps match that search.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
