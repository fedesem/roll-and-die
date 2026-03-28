import { ScrollText, Trash2 } from "lucide-react";

import type {
  ActorKind,
  ActorSheet,
  CampaignSnapshot,
  MemberRole,
  MonsterTemplate
} from "@shared/types";

import { CharacterSheet } from "./CharacterSheet";
import { RulesText } from "./admin/AdminPreview";
import type {
  ActorTypeFilter,
  AvailableActorEntry
} from "../features/campaign/types";
import { MonsterCatalogOption, MonsterStatBlock } from "./monster/MonsterStatBlock";

interface CampaignActorManagerProps {
  token: string;
  role: MemberRole;
  currentUserId: string;
  compendium: CampaignSnapshot["compendium"];
  selectedActor: ActorSheet | null;
  availableActors: AvailableActorEntry[];
  actorSearch: string;
  actorTypeFilter: ActorTypeFilter;
  actorCreatorKind: ActorKind;
  actorCreatorOpen: boolean;
  actorDraft: ActorSheet | null;
  monsterQuery: string;
  filteredCatalog: MonsterTemplate[];
  selectedMonsterTemplate: MonsterTemplate | null;
  onOpenSheet: (actorId: string) => void;
  onRoll: (notation: string, label: string, actor?: ActorSheet | null) => Promise<void>;
  onActorSearchChange: (value: string) => void;
  onActorTypeFilterChange: (value: ActorTypeFilter) => void;
  onActorCreatorOpenChange: (open: boolean) => void;
  onActorCreatorKindChange: (kind: ActorKind) => void;
  onCreateActor: (draft: ActorSheet) => Promise<void>;
  onMonsterQueryChange: (value: string) => void;
  onSelectMonster: (monsterId: string) => void;
  onCreateMonsterActor: (monster: MonsterTemplate) => void;
  onDeleteActor: (actor: ActorSheet) => void;
}

export function CampaignActorManager({
  token,
  role,
  currentUserId,
  compendium,
  selectedActor,
  availableActors,
  actorSearch,
  actorTypeFilter,
  actorCreatorKind,
  actorCreatorOpen,
  actorDraft,
  monsterQuery,
  filteredCatalog,
  selectedMonsterTemplate,
  onOpenSheet,
  onRoll,
  onActorSearchChange,
  onActorTypeFilterChange,
  onActorCreatorOpenChange,
  onActorCreatorKindChange,
  onCreateActor,
  onMonsterQueryChange,
  onSelectMonster,
  onCreateMonsterActor,
  onDeleteActor
}: CampaignActorManagerProps) {
  const canManageActor = (actor: ActorSheet) => role === "dm" || actor.ownerId === currentUserId;
  const canOpenSheet = (actor: ActorSheet) => role === "dm" || actor.sheetAccess === "full" || actor.ownerId === currentUserId;
  const availableHeading = role === "dm" ? "Available actors" : "Your actors";
  const monsterLabel = role === "dm" ? "Monster" : "Monster summon / familiar";
  const monsterActionLabel = role === "dm" ? "Add to roster" : "Create summon / familiar";

  return (
    <div className="popup-grid">
      <section className="dark-card popup-card actor-list-card">
        <div className="panel-head">
          <div>
            <p className="panel-label">Roster</p>
            <h2>{availableHeading}</h2>
          </div>
          <span className="badge subtle">{availableActors.length}</span>
        </div>
        <div className="actor-filter-row">
          <input
            placeholder={role === "dm" ? "Search available actors" : "Search your actors"}
            value={actorSearch}
            onChange={(event) => onActorSearchChange(event.target.value)}
          />
          <select
            value={actorTypeFilter}
            onChange={(event) => onActorTypeFilterChange(event.target.value as ActorTypeFilter)}
          >
            <option value="all">All types</option>
            <option value="character">Characters</option>
            <option value="npc">NPCs</option>
            <option value="monster">Monsters</option>
            <option value="static">Static</option>
          </select>
        </div>
        <div className="actor-list-scroll">
          <div className="list-stack">
            {availableActors.map(({ actor, activeMaps, onCurrentMap }) => {
              const canManage = canManageActor(actor);

              return (
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
                      disabled={!canOpenSheet(actor)}
                      onClick={() => onOpenSheet(actor.id)}
                    >
                      <ScrollText size={15} />
                    </button>
                    {canManage && (
                      <button
                        type="button"
                        className="icon-action-button danger-button"
                        title="Delete actor"
                        onClick={() => onDeleteActor(actor)}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {availableActors.length === 0 && (
              <p className="empty-state">
                {role === "dm" ? "No actors match that search." : "You do not have any actors yet."}
              </p>
            )}
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
            onClick={() => onActorCreatorOpenChange(!actorCreatorOpen)}
          >
            {actorCreatorOpen ? "Close" : "Create actor"}
          </button>
        </div>
        {actorCreatorOpen && (
          <div className="stack-form">
            <div className="inline-form compact">
              <select
                value={actorCreatorKind}
                onChange={(event) => onActorCreatorKindChange(event.target.value as ActorKind)}
              >
                <option value="character">Character</option>
                <option value="monster">{monsterLabel}</option>
                {role === "dm" && <option value="npc">NPC</option>}
                {role === "dm" && <option value="static">Static</option>}
              </select>
            </div>

            {actorCreatorKind === "monster" ? (
              <div className="popup-grid monster-browser">
                <section className="sheet-panel">
                  <input
                    placeholder="Search monsters"
                    value={monsterQuery}
                    onChange={(event) => onMonsterQueryChange(event.target.value)}
                  />
                  <div className="monster-list">
                    {filteredCatalog.map((monster) => (
                      <MonsterCatalogOption
                        key={monster.id}
                        monster={monster}
                        selected={selectedMonsterTemplate?.id === monster.id}
                        onSelect={() => onSelectMonster(monster.id)}
                      />
                    ))}
                    {filteredCatalog.length === 0 && <p className="empty-state">No monsters match that search.</p>}
                  </div>
                </section>
                <section className="sheet-panel monster-preview-card">
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
                      action={(
                        <button
                          className="accent-button"
                          type="button"
                          onClick={() => onCreateMonsterActor(selectedMonsterTemplate)}
                        >
                          {monsterActionLabel}
                        </button>
                      )}
                    />
                  ) : (
                    <p className="empty-state">Select a monster to preview its stat block.</p>
                  )}
                </section>
              </div>
            ) : (
              actorDraft && (
                <CharacterSheet
                  token={token}
                  actor={actorDraft}
                  compendium={compendium}
                  role={role}
                  currentUserId={currentUserId}
                  onSave={onCreateActor}
                  onRoll={onRoll}
                />
              )
            )}
          </div>
        )}
      </section>
    </div>
  );
}
