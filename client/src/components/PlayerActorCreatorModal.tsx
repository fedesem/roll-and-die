import { useEffect, useMemo, useState } from "react";
import { FilePlus2 } from "lucide-react";

import type { ActorKind, ActorSheet, CampaignSnapshot, MemberRole, MonsterTemplate } from "@shared/types";

import { CharacterSheet } from "./CharacterSheet";
import { CampaignActionButton } from "./CampaignActionButton";
import { RulesText } from "./admin/AdminPreview";
import { MonsterCatalogOption, MonsterStatBlock } from "./monster/MonsterStatBlock";

interface PlayerActorCreatorModalProps {
  token: string;
  role: MemberRole;
  currentUserId: string;
  compendium: CampaignSnapshot["compendium"];
  allowedSourceBooks: string[];
  actorCreatorKind: ActorKind;
  actorDraft: ActorSheet | null;
  monsterQuery: string;
  filteredCatalog: MonsterTemplate[];
  selectedMonsterTemplate: MonsterTemplate | null;
  onRoll: (notation: string, label: string, actor?: ActorSheet | null) => Promise<void>;
  onActorCreatorKindChange: (kind: ActorKind) => void;
  onCreateActor: (draft: ActorSheet) => Promise<void>;
  onMonsterQueryChange: (value: string) => void;
  onSelectMonster: (monsterId: string) => void;
  onCreateMonsterActor: (monster: MonsterTemplate) => void;
}

type MonsterListSort = "name-asc" | "source-asc" | "cr-asc" | "cr-desc";

export function PlayerActorCreatorModal({
  token,
  role,
  currentUserId,
  compendium,
  allowedSourceBooks,
  actorCreatorKind,
  actorDraft,
  monsterQuery,
  filteredCatalog,
  selectedMonsterTemplate,
  onRoll,
  onActorCreatorKindChange,
  onCreateActor,
  onMonsterQueryChange,
  onSelectMonster,
  onCreateMonsterActor
}: PlayerActorCreatorModalProps) {
  const [monsterSourceFilter, setMonsterSourceFilter] = useState("");
  const [monsterCrFilter, setMonsterCrFilter] = useState("");
  const [monsterTypeFilter, setMonsterTypeFilter] = useState("");
  const [monsterSort, setMonsterSort] = useState<MonsterListSort>("name-asc");

  const monsterSourceOptions = useMemo(() => uniqueMonsterSourceOptions(filteredCatalog), [filteredCatalog]);
  const monsterCrOptions = useMemo(() => uniqueMonsterValues(filteredCatalog.map((monster) => monster.challengeRating)), [filteredCatalog]);
  const monsterTypeOptions = useMemo(() => uniqueMonsterValues(filteredCatalog.map((monster) => monster.creatureType)), [filteredCatalog]);
  const displayedMonsterCatalog = useMemo(
    () =>
      filterAndSortMonsterCatalog(filteredCatalog, {
        source: monsterSourceFilter,
        challengeRating: monsterCrFilter,
        creatureType: monsterTypeFilter,
        sort: monsterSort
      }),
    [filteredCatalog, monsterCrFilter, monsterSort, monsterSourceFilter, monsterTypeFilter]
  );
  const visibleSelectedMonsterTemplate = useMemo(
    () => displayedMonsterCatalog.find((monster) => monster.id === selectedMonsterTemplate?.id) ?? displayedMonsterCatalog[0] ?? null,
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
    <div className="stack-form min-h-0">
      <div className="inline-form compact">
        <select value={actorCreatorKind} onChange={(event) => onActorCreatorKindChange(event.target.value as ActorKind)}>
          <option value="character">Character</option>
          <option value="monster">{role === "dm" ? "Monster" : "Monster summon / familiar"}</option>
        </select>
      </div>

      {actorCreatorKind === "monster" ? (
        <div className="popup-grid monster-browser min-h-0">
          <section className="sheet-panel monster-browser-list-panel">
            <input placeholder="Search monsters" value={monsterQuery} onChange={(event) => onMonsterQueryChange(event.target.value)} />
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
                action={
                  <CampaignActionButton onClick={() => onCreateMonsterActor(visibleSelectedMonsterTemplate)} icon={FilePlus2} tone="accent">
                    {role === "dm" ? "Add to roster" : "Create summon / familiar"}
                  </CampaignActionButton>
                }
              />
            ) : (
              <p className="empty-state">Select a monster to preview its stat block.</p>
            )}
          </section>
        </div>
      ) : actorDraft ? (
        <CharacterSheet
          token={token}
          actor={actorDraft}
          compendium={compendium}
          allowedSourceBooks={allowedSourceBooks}
          role={role}
          currentUserId={currentUserId}
          sheetContext="campaign"
          onSave={onCreateActor}
          onRoll={onRoll}
        />
      ) : null}
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
    .sort((left, right) => {
      switch (controls.sort) {
        case "source-asc":
          return left.source.localeCompare(right.source) || left.name.localeCompare(right.name);
        case "cr-asc":
          return compareChallengeRating(left.challengeRating, right.challengeRating) || left.name.localeCompare(right.name);
        case "cr-desc":
          return compareChallengeRating(right.challengeRating, left.challengeRating) || left.name.localeCompare(right.name);
        case "name-asc":
        default:
          return left.name.localeCompare(right.name) || left.source.localeCompare(right.source);
      }
    });
}

function normalizeMonsterSourceId(source: string) {
  return source.trim().toLowerCase();
}

function compareChallengeRating(left: string, right: string) {
  return parseChallengeRating(left) - parseChallengeRating(right);
}

function parseChallengeRating(value: string) {
  const normalized = value.trim();

  if (normalized.includes("/")) {
    const [numerator, denominator] = normalized.split("/").map((part) => Number(part));
    return denominator ? numerator / denominator : 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function uniqueMonsterSourceOptions(entries: MonsterTemplate[]) {
  return Array.from(
    new Map(entries.map((entry) => [normalizeMonsterSourceId(entry.source), { value: normalizeMonsterSourceId(entry.source), label: entry.source }])).values()
  ).sort((left, right) => left.label.localeCompare(right.label));
}

function uniqueMonsterValues(values: string[]) {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right));
}
