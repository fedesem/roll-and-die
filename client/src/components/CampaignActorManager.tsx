import { useEffect, useMemo, useState } from "react";
import {
  FilePlus2,
  Map,
  MapPinned,
  ScrollText,
  Skull,
  Square,
  Trash2,
  User,
  Users
} from "lucide-react";

import type {
  ActorKind,
  ActorSheet,
  CampaignMap,
  CampaignMember,
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
import { CampaignActionButton } from "./CampaignActionButton";
import { MonsterCatalogOption, MonsterStatBlock } from "./monster/MonsterStatBlock";

interface CampaignActorManagerProps {
  token: string;
  role: MemberRole;
  currentUserId: string;
  campaignMaps: CampaignMap[];
  campaignMembers: CampaignMember[];
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

type MonsterListSort = "name-asc" | "source-asc" | "cr-asc" | "cr-desc";

export function CampaignActorManager({
  token,
  role,
  currentUserId,
  campaignMaps,
  campaignMembers,
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
  const [ownerFilter, setOwnerFilter] = useState("__all__");
  const [mapFilter, setMapFilter] = useState("__all__");
  const [monsterSourceFilter, setMonsterSourceFilter] = useState("");
  const [monsterCrFilter, setMonsterCrFilter] = useState("");
  const [monsterTypeFilter, setMonsterTypeFilter] = useState("");
  const [monsterSort, setMonsterSort] = useState<MonsterListSort>("name-asc");
  const canManageActor = (actor: ActorSheet) => role === "dm" || actor.ownerId === currentUserId;
  const canOpenSheet = (actor: ActorSheet) => role === "dm" || actor.sheetAccess === "full" || actor.ownerId === currentUserId;
  const availableHeading = role === "dm" ? "Available actors" : "Your actors";
  const monsterLabel = role === "dm" ? "Monster" : "Monster summon / familiar";
  const monsterActionLabel = role === "dm" ? "Add to roster" : "Create summon / familiar";
  const filteredActors = useMemo(
    () => {
      if (role !== "dm") {
        return availableActors;
      }

      return availableActors.filter((entry) => {
        if (ownerFilter === "__unowned__") {
          if (entry.actor.ownerId) {
            return false;
          }
        } else if (ownerFilter === "__dm__") {
          if (entry.ownerRole !== "dm") {
            return false;
          }
        } else if (ownerFilter === "__players__") {
          if (entry.ownerRole !== "player") {
            return false;
          }
        } else if (ownerFilter !== "__all__" && entry.actor.ownerId !== ownerFilter) {
          return false;
        }

        if (mapFilter === "__all__") {
          return true;
        }

        if (mapFilter === "__unassigned__") {
          return entry.activeMaps.length === 0;
        }

        return entry.activeMaps.some((map) => map.id === mapFilter);
      });
    },
    [availableActors, mapFilter, ownerFilter, role]
  );
  const monsterSourceOptions = useMemo(() => uniqueMonsterSourceOptions(filteredCatalog), [filteredCatalog]);
  const monsterCrOptions = useMemo(() => uniqueMonsterValues(filteredCatalog.map((monster) => monster.challengeRating)), [filteredCatalog]);
  const monsterTypeOptions = useMemo(() => uniqueMonsterValues(filteredCatalog.map((monster) => monster.creatureType)), [filteredCatalog]);
  const filteredMonsterCatalog = useMemo(
    () => filterAndSortMonsterCatalog(filteredCatalog, {
      source: monsterSourceFilter,
      challengeRating: monsterCrFilter,
      creatureType: monsterTypeFilter,
      sort: monsterSort
    }),
    [filteredCatalog, monsterCrFilter, monsterSort, monsterSourceFilter, monsterTypeFilter]
  );
  const shouldCapInitialMonsterList =
    monsterQuery.trim().length === 0 &&
    monsterSourceFilter.length === 0 &&
    monsterCrFilter.length === 0 &&
    monsterTypeFilter.length === 0;
  const displayedMonsterCatalog = useMemo(
    () => (shouldCapInitialMonsterList ? filteredMonsterCatalog.slice(0, 20) : filteredMonsterCatalog),
    [filteredMonsterCatalog, shouldCapInitialMonsterList]
  );
  const visibleSelectedMonsterTemplate = useMemo(
    () =>
      displayedMonsterCatalog.find((monster) => monster.id === selectedMonsterTemplate?.id) ??
      displayedMonsterCatalog[0] ??
      null,
    [displayedMonsterCatalog, selectedMonsterTemplate]
  );

  useEffect(() => {
    if (!visibleSelectedMonsterTemplate) {
      return;
    }

    if (selectedMonsterTemplate?.id === visibleSelectedMonsterTemplate.id) {
      return;
    }

    onSelectMonster(visibleSelectedMonsterTemplate.id);
  }, [onSelectMonster, selectedMonsterTemplate, visibleSelectedMonsterTemplate]);

  return (
    <div className="popup-grid">
      <section className="dark-card popup-card actor-list-card">
        <div className="panel-head">
          <div>
            <p className="panel-label">Roster</p>
            <h2>{availableHeading}</h2>
          </div>
          <span className="badge subtle">{filteredActors.length}</span>
        </div>
        {role === "dm" ? (
          <div className="actor-filter-row">
            <input
              placeholder="Search available actors"
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
            <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
              <option value="__all__">All owners</option>
              <option value="__players__">Player-owned</option>
              <option value="__dm__">DM-owned</option>
              <option value="__unowned__">Unowned</option>
              {campaignMembers.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name}
                </option>
              ))}
            </select>
            <select value={mapFilter} onChange={(event) => setMapFilter(event.target.value)}>
              <option value="__all__">All maps</option>
              <option value="__unassigned__">No map</option>
              {campaignMaps.map((map) => (
                <option key={map.id} value={map.id}>
                  {map.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="actor-filter-row">
            <input
              placeholder="Search your actors"
              value={actorSearch}
              onChange={(event) => onActorSearchChange(event.target.value)}
            />
          </div>
        )}
        <div className="actor-list-scroll">
          <div className="list-stack">
            {filteredActors.map(({ actor, activeMaps, onCurrentMap, isOnAllMaps, ownerName }) => {
              const canManage = canManageActor(actor);

              return (
                <div key={actor.id} className="popup-row actor-popup-row">
                  <div className={`list-row actor-list-row-static ${selectedActor?.id === actor.id ? "is-selected" : ""}`}>
                    <div className="actor-row-main">
                      <span className="actor-row-name">{actor.name}</span>
                      <div className="actor-row-meta">
                        <ActorMetaIconBadge icon={iconForActorKind(actor.kind)} label={actor.kind} />
                        {role === "dm" ? <ActorOwnerBadge ownerName={ownerName} /> : null}
                        {role === "dm" && onCurrentMap ? <ActorMetaIconBadge icon={MapPinned} label="Assigned" /> : null}
                        {role === "dm"
                          ? isOnAllMaps
                            ? <ActorMetaIconBadge icon={Map} label="All maps" />
                            : activeMaps.map((map) => (
                                <span key={map.id} className="badge map-badge">
                                  {map.name}
                                </span>
                              ))
                          : null}
                      </div>
                    </div>
                  </div>
                  <div className="actor-list-actions">
                    <CampaignActionButton
                      title="Open sheet"
                      aria-label="Open sheet"
                      disabled={!canOpenSheet(actor)}
                      onClick={() => onOpenSheet(actor.id)}
                      icon={ScrollText}
                    />
                    {canManage && (
                      <CampaignActionButton
                        title="Delete actor"
                        onClick={() => onDeleteActor(actor)}
                        aria-label="Delete actor"
                        icon={Trash2}
                        tone="danger"
                      />
                    )}
                  </div>
                </div>
              );
            })}
            {filteredActors.length === 0 && (
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
            <h2>{role === "dm" ? "Map-scoped actors" : "New actor"}</h2>
          </div>
          {role !== "dm" && (
            <button
              className={actorCreatorOpen ? "accent-button" : ""}
              type="button"
              onClick={() => onActorCreatorOpenChange(!actorCreatorOpen)}
            >
              {actorCreatorOpen ? "Close" : "Create actor"}
            </button>
          )}
        </div>
        {role === "dm" ? (
          <p className="empty-state">
            Create DM-owned actors from the Maps tab after selecting the map you want to edit. Player-owned actors still
            appear here in the general roster.
          </p>
        ) : actorCreatorOpen && (
          <div className="stack-form">
            <div className="inline-form compact">
              <select
                value={actorCreatorKind}
                onChange={(event) => onActorCreatorKindChange(event.target.value as ActorKind)}
              >
                <option value="character">Character</option>
                <option value="monster">{monsterLabel}</option>
              </select>
            </div>

            {actorCreatorKind === "monster" ? (
              <div className="popup-grid monster-browser">
                <section className="sheet-panel monster-browser-list-panel">
                  <input
                    placeholder="Search monsters"
                    value={monsterQuery}
                    onChange={(event) => onMonsterQueryChange(event.target.value)}
                  />
                  <div className="grid gap-3 md:grid-cols-4">
                    <label className="grid gap-2 text-sm text-slate-300">
                      <span>Source</span>
                      <select value={monsterSourceFilter} onChange={(event) => setMonsterSourceFilter(event.target.value)}>
                        <option value="">All sources</option>
                        {monsterSourceOptions.map((option) => (
                          <option key={option.value} value={option.value} title={option.label}>
                            {option.value}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-2 text-sm text-slate-300">
                      <span>CR</span>
                      <select value={monsterCrFilter} onChange={(event) => setMonsterCrFilter(event.target.value)}>
                        <option value="">All CR</option>
                        {monsterCrOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-2 text-sm text-slate-300">
                      <span>Type</span>
                      <select value={monsterTypeFilter} onChange={(event) => setMonsterTypeFilter(event.target.value)}>
                        <option value="">All monster types</option>
                        {monsterTypeOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-2 text-sm text-slate-300">
                      <span>Sort</span>
                      <select value={monsterSort} onChange={(event) => setMonsterSort(event.target.value as MonsterListSort)}>
                        <option value="name-asc">Name A-Z</option>
                        <option value="source-asc">Source A-Z</option>
                        <option value="cr-asc">CR Low-High</option>
                        <option value="cr-desc">CR High-Low</option>
                      </select>
                    </label>
                  </div>
                  <div className="actor-list-scroll actor-creation-results">
                    <div className="monster-list">
                      {displayedMonsterCatalog.map((monster) => (
                        <MonsterCatalogOption
                          key={monster.id}
                          monster={monster}
                          selected={visibleSelectedMonsterTemplate?.id === monster.id}
                          onSelect={() => onSelectMonster(monster.id)}
                        />
                      ))}
                      {displayedMonsterCatalog.length === 0 ? <p className="empty-state">No monsters match those filters.</p> : null}
                      {shouldCapInitialMonsterList && filteredMonsterCatalog.length > displayedMonsterCatalog.length ? (
                        <p className="empty-state">Showing the first 20 monsters. Search for it to find more.</p>
                      ) : null}
                    </div>
                  </div>
                </section>
                <section className="sheet-panel monster-preview-card monster-browser-preview-panel">
                  {visibleSelectedMonsterTemplate ? (
                    <MonsterStatBlock
                      monster={visibleSelectedMonsterTemplate}
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
                        <CampaignActionButton
                          onClick={() => onCreateMonsterActor(visibleSelectedMonsterTemplate)}
                          icon={FilePlus2}
                          tone="accent"
                        >
                          {monsterActionLabel}
                        </CampaignActionButton>
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

function filterAndSortMonsterCatalog(
  entries: MonsterTemplate[],
  controls: {
    source: string;
    challengeRating: string;
    creatureType: string;
    sort: MonsterListSort;
  }
) {
  return [...entries]
    .filter((entry) => !controls.source || normalizeMonsterSourceId(entry.source) === controls.source)
    .filter((entry) => !controls.challengeRating || entry.challengeRating === controls.challengeRating)
    .filter((entry) => !controls.creatureType || entry.creatureType === controls.creatureType)
    .sort((left, right) => compareMonsterEntries(left, right, controls.sort));
}

function compareMonsterEntries(left: MonsterTemplate, right: MonsterTemplate, sort: MonsterListSort) {
  switch (sort) {
    case "source-asc":
      return left.source.localeCompare(right.source) || left.name.localeCompare(right.name);
    case "cr-asc":
      return parseChallengeRating(left.challengeRating) - parseChallengeRating(right.challengeRating) || left.name.localeCompare(right.name);
    case "cr-desc":
      return parseChallengeRating(right.challengeRating) - parseChallengeRating(left.challengeRating) || left.name.localeCompare(right.name);
    case "name-asc":
    default:
      return left.name.localeCompare(right.name);
  }
}

function parseChallengeRating(value: string) {
  if (value.includes("/")) {
    const [numerator, denominator] = value.split("/").map((entry) => Number(entry));
    return denominator ? numerator / denominator : 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeMonsterSourceId(source: string) {
  return source.split(/\s+p\.\d+/i)[0]?.trim() ?? source.trim();
}

function uniqueMonsterSourceOptions(entries: MonsterTemplate[]) {
  const seen = new Set<string>();

  return entries
    .map((entry) => ({ value: normalizeMonsterSourceId(entry.source), label: entry.source }))
    .filter((entry) => {
      if (!entry.value || seen.has(entry.value)) {
        return false;
      }

      seen.add(entry.value);
      return true;
    })
    .sort((left, right) => left.label.localeCompare(right.label));
}

function uniqueMonsterValues(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function iconForActorKind(kind: ActorKind): typeof User {
  switch (kind) {
    case "character":
      return User;
    case "npc":
      return Users;
    case "monster":
      return Skull;
    case "static":
      return Square;
  }
}

function ActorOwnerBadge({ ownerName }: { ownerName: string }) {
  return (
    <span className="badge subtle actor-owner-badge" title={ownerName}>
      {ownerName}
    </span>
  );
}

function ActorMetaIconBadge({
  icon: Icon,
  label
}: {
  icon: typeof User;
  label: string;
}) {
  return (
    <span className="badge subtle actor-meta-icon-badge" title={label} aria-label={label}>
      <Icon />
    </span>
  );
}
