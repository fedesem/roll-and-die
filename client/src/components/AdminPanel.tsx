import { useEffect, useMemo, useState, type ComponentType, type FormEvent, type ReactNode } from "react";
import { ArrowDownToLine, FilePlus2, GraduationCap, List, RefreshCw, ShieldPlus, Skull, Sparkles, Users } from "lucide-react";

import type { AdminOverview, SpellEntry } from "@shared/types";
import { apiRequest } from "../api";
import { ClassPreviewCard, FeatPreviewCard, MonsterPreviewCard, PreviewError, PreviewPlaceholder, SpellPreviewCard, UserPreviewCard } from "./admin/AdminPreview";
import {
  classFormToEntry,
  createClassForm,
  createFeatForm,
  createMonsterForm,
  createSpellForm,
  featFormToEntry,
  monsterActionTemplate,
  monsterFormToEntry,
  spellFormToEntry,
  type ClassFormState,
  type FeatFormState,
  type MonsterFormState,
  type SpellFormState
} from "../lib/adminDrafts";
import { toErrorMessage } from "../lib/errors";

type AdminTab = "users" | "spells" | "monsters" | "feats" | "classes";
type CompendiumTab = Exclude<AdminTab, "users">;
type AdminMode = "list" | "add" | "import";

interface AdminPanelProps {
  token: string;
  currentUserId: string;
  onStatus: (tone: "info" | "error", text: string) => void;
}

interface PreviewState<T> {
  entry: T | null;
  error: string | null;
}

const tabIcons = {
  users: Users,
  spells: Sparkles,
  monsters: Skull,
  feats: ShieldPlus,
  classes: GraduationCap
} satisfies Record<AdminTab, ComponentType<{ size?: number }>>;

export function AdminPanel({ token, currentUserId, onStatus }: AdminPanelProps) {
  const [tab, setTab] = useState<AdminTab>("users");
  const [mode, setMode] = useState<AdminMode>("list");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState<Record<AdminTab, string>>({
    users: "",
    spells: "",
    monsters: "",
    feats: "",
    classes: ""
  });
  const [selectedIds, setSelectedIds] = useState<Record<AdminTab, string | null>>({
    users: null,
    spells: null,
    monsters: null,
    feats: null,
    classes: null
  });
  const [jsonImport, setJsonImport] = useState<Record<CompendiumTab, string>>({
    spells: "",
    monsters: "",
    feats: "",
    classes: ""
  });
  const [spellForm, setSpellForm] = useState<SpellFormState>(createSpellForm());
  const [monsterForm, setMonsterForm] = useState<MonsterFormState>(createMonsterForm());
  const [featForm, setFeatForm] = useState<FeatFormState>(createFeatForm());
  const [classForm, setClassForm] = useState<ClassFormState>(createClassForm());
  const activeCompendiumTab: CompendiumTab | null = tab === "users" ? null : tab;

  useEffect(() => {
    void refreshOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (tab === "users" && mode !== "list") {
      setMode("list");
    }
  }, [mode, tab]);

  const counts = useMemo(
    () => ({
      users: overview?.users.length ?? 0,
      spells: overview?.compendium.spells.length ?? 0,
      monsters: overview?.compendium.monsters.length ?? 0,
      feats: overview?.compendium.feats.length ?? 0,
      classes: overview?.compendium.classes.length ?? 0
    }),
    [overview]
  );

  const users = useMemo(
    () => filterEntries(overview?.users ?? [], search.users, (user) => [user.name, user.email, user.isAdmin ? "admin" : "user"]),
    [overview?.users, search.users]
  );
  const spells = useMemo(
    () => filterEntries(overview?.compendium.spells ?? [], search.spells, (entry) => [entry.name, entry.source, String(entry.level), entry.school]),
    [overview?.compendium.spells, search.spells]
  );
  const monsters = useMemo(
    () => filterEntries(overview?.compendium.monsters ?? [], search.monsters, (entry) => [entry.name, entry.source, entry.challengeRating]),
    [overview?.compendium.monsters, search.monsters]
  );
  const feats = useMemo(
    () => filterEntries(overview?.compendium.feats ?? [], search.feats, (entry) => [entry.name, entry.source, entry.category]),
    [overview?.compendium.feats, search.feats]
  );
  const classes = useMemo(
    () => filterEntries(overview?.compendium.classes ?? [], search.classes, (entry) => [entry.name, entry.source]),
    [overview?.compendium.classes, search.classes]
  );

  const selectedUser = resolveSelected(users, selectedIds.users);
  const selectedSpell = resolveSelected(spells, selectedIds.spells);
  const selectedMonster = resolveSelected(monsters, selectedIds.monsters);
  const selectedFeat = resolveSelected(feats, selectedIds.feats);
  const selectedClass = resolveSelected(classes, selectedIds.classes);

  const spellPreview = useMemo(() => buildPreview(() => spellFormToEntry(spellForm)), [spellForm]);
  const monsterPreview = useMemo(() => buildPreview(() => monsterFormToEntry(monsterForm)), [monsterForm]);
  const featPreview = useMemo(() => buildPreview(() => featFormToEntry(featForm)), [featForm]);
  const classPreview = useMemo(() => buildPreview(() => classFormToEntry(classForm)), [classForm]);

  const importSummary = useMemo(() => {
    if (!activeCompendiumTab) {
      return null;
    }

    const value = jsonImport[activeCompendiumTab];

    if (!value.trim()) {
      return { valid: false, message: "Paste one JSON object or an array to import." };
    }

    try {
      const parsed = JSON.parse(value) as unknown;
      const count = Array.isArray(parsed) ? parsed.length : 1;
      return {
        valid: true,
        message: `${count} ${count === 1 ? singularLabel(activeCompendiumTab) : labelForTab(activeCompendiumTab)} ready to import.`
      };
    } catch (error) {
      return { valid: false, message: toErrorMessage(error) };
    }
  }, [activeCompendiumTab, jsonImport]);
  const importExample = useMemo(
    () => (activeCompendiumTab ? getImportExample(activeCompendiumTab) : ""),
    [activeCompendiumTab]
  );

  async function refreshOverview() {
    setLoading(true);

    try {
      const next = await apiRequest<AdminOverview>("/admin/overview", { token });
      setOverview(next);
    } catch (error) {
      onStatus("error", toErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function promoteUser(userId: string) {
    try {
      await apiRequest(`/admin/users/${userId}/promote`, {
        method: "POST",
        token
      });
      onStatus("info", "User promoted to administrator.");
      await refreshOverview();
    } catch (error) {
      onStatus("error", toErrorMessage(error));
    }
  }

  async function demoteUser(userId: string) {
    try {
      await apiRequest(`/admin/users/${userId}/demote`, {
        method: "POST",
        token
      });
      onStatus("info", "User demoted.");
      await refreshOverview();
    } catch (error) {
      onStatus("error", toErrorMessage(error));
    }
  }

  async function createEntry(kind: CompendiumTab, entry: unknown, reset: () => void) {
    try {
      const created = await apiRequest<{ id: string }>(`/admin/compendium/${kind}`, {
        method: "POST",
        token,
        body: entry
      });

      reset();
      setSelectedIds((current) => ({ ...current, [kind]: created.id }));
      setMode("list");
      onStatus("info", `${singularLabel(kind)} added.`);
      await refreshOverview();
    } catch (error) {
      onStatus("error", toErrorMessage(error));
    }
  }

  async function importEntries(kind: CompendiumTab) {
    try {
      const payload = JSON.parse(jsonImport[kind]) as unknown;
      await apiRequest(`/admin/compendium/${kind}/import`, {
        method: "POST",
        token,
        body: { entries: payload }
      });

      setJsonImport((current) => ({ ...current, [kind]: "" }));
      setMode("list");
      onStatus("info", `${labelForTab(kind)} import completed.`);
      await refreshOverview();
    } catch (error) {
      onStatus("error", toErrorMessage(error));
    }
  }

  function handleSpellSubmit(event: FormEvent) {
    event.preventDefault();
    void createEntry("spells", spellFormToEntry(spellForm), () => setSpellForm(createSpellForm()));
  }

  function handleMonsterSubmit(event: FormEvent) {
    event.preventDefault();
    void createEntry("monsters", monsterFormToEntry(monsterForm), () => setMonsterForm(createMonsterForm()));
  }

  function handleFeatSubmit(event: FormEvent) {
    event.preventDefault();
    void createEntry("feats", featFormToEntry(featForm), () => setFeatForm(createFeatForm()));
  }

  function handleClassSubmit(event: FormEvent) {
    event.preventDefault();
    void createEntry("classes", classFormToEntry(classForm), () => setClassForm(createClassForm()));
  }

  return (
    <main className="admin-page">
      <section className="dark-card admin-page-shell">
        <div className="panel-head admin-page-head">
          <div>
            <p className="panel-label">System</p>
            <h2>Administrator area</h2>
          </div>
          <button type="button" onClick={() => void refreshOverview()} disabled={loading}>
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="admin-page-toolbar">
          <div className="segmented admin-tabbar">
            {(Object.keys(tabIcons) as AdminTab[]).map((value) => {
              const Icon = tabIcons[value];
              return (
                <button key={value} type="button" className={tab === value ? "is-active" : ""} onClick={() => setTab(value)}>
                  <Icon size={15} />
                  <span>{labelForTab(value)}</span>
                  <span className="badge subtle">{counts[value]}</span>
                </button>
              );
            })}
          </div>

          <div className="admin-mode-bar">
            <button type="button" className={mode === "list" ? "accent-button" : ""} onClick={() => setMode("list")}>
              <List size={15} />
              <span>List</span>
            </button>
            {tab !== "users" && (
              <>
                <button type="button" className={mode === "add" ? "accent-button" : ""} onClick={() => setMode("add")}>
                  <FilePlus2 size={15} />
                  <span>Add</span>
                </button>
                <button type="button" className={mode === "import" ? "accent-button" : ""} onClick={() => setMode("import")}>
                  <ArrowDownToLine size={15} />
                  <span>Import</span>
                </button>
              </>
            )}
          </div>
        </div>

        {tab === "users" || mode === "list" ? (
          <div className="admin-content-grid">
            <section className="admin-pane admin-list-pane">
              <div className="panel-head">
                <div>
                  <p className="panel-label">Library</p>
                  <h3>{labelForTab(tab)}</h3>
                </div>
                <span className="badge subtle">{countForTab(tab, counts)}</span>
              </div>
              <label className="admin-search-field">
                <span>Search</span>
                <input
                  placeholder={`Search ${labelForTab(tab).toLowerCase()}`}
                  value={search[tab]}
                  onChange={(event) => setSearch((current) => ({ ...current, [tab]: event.target.value }))}
                />
              </label>
              <div className="admin-list-scroll">
                {tab === "users" &&
                  users.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className={`admin-list-row ${selectedUser?.id === user.id ? "is-selected" : ""}`}
                      onClick={() => setSelectedIds((current) => ({ ...current, users: user.id }))}
                    >
                      <div className="admin-list-main">
                        <strong>{user.name}</strong>
                        <small>{user.email}</small>
                      </div>
                      <div className="admin-list-badges">
                        <span className={`badge ${user.isAdmin ? "" : "subtle"}`}>{user.isAdmin ? "Admin" : "User"}</span>
                        {user.id === currentUserId ? <span className="badge subtle">You</span> : null}
                      </div>
                    </button>
                  ))}

                {tab === "spells" &&
                  spells.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      className={`admin-list-row ${selectedSpell?.id === entry.id ? "is-selected" : ""}`}
                      onClick={() => setSelectedIds((current) => ({ ...current, spells: entry.id }))}
                    >
                      <div className="admin-list-main">
                        <strong>{entry.name}</strong>
                        <small>{entry.school}</small>
                      </div>
                      <div className="admin-list-badges">
                        <span className="badge subtle">{entry.level === "cantrip" ? "Cantrip" : `Lvl ${entry.level}`}</span>
                        <span className="badge subtle">{entry.source}</span>
                      </div>
                    </button>
                  ))}

                {tab === "monsters" &&
                  monsters.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      className={`admin-list-row ${selectedMonster?.id === entry.id ? "is-selected" : ""}`}
                      onClick={() => setSelectedIds((current) => ({ ...current, monsters: entry.id }))}
                    >
                      <div className="admin-list-main">
                        <strong>{entry.name}</strong>
                        <small>{entry.source}</small>
                      </div>
                      <div className="admin-list-badges">
                        <span className="badge subtle">CR {entry.challengeRating}</span>
                      </div>
                    </button>
                  ))}

                {tab === "feats" &&
                  feats.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      className={`admin-list-row ${selectedFeat?.id === entry.id ? "is-selected" : ""}`}
                      onClick={() => setSelectedIds((current) => ({ ...current, feats: entry.id }))}
                    >
                      <div className="admin-list-main">
                        <strong>{entry.name}</strong>
                        <small>{entry.category}</small>
                      </div>
                      <div className="admin-list-badges">
                        <span className="badge subtle">{entry.source}</span>
                      </div>
                    </button>
                  ))}

                {tab === "classes" &&
                  classes.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      className={`admin-list-row ${selectedClass?.id === entry.id ? "is-selected" : ""}`}
                      onClick={() => setSelectedIds((current) => ({ ...current, classes: entry.id }))}
                    >
                      <div className="admin-list-main">
                        <strong>{entry.name}</strong>
                        <small>{entry.features.length} features</small>
                      </div>
                      <div className="admin-list-badges">
                        <span className="badge subtle">{entry.source}</span>
                      </div>
                    </button>
                  ))}

                {countForTab(tab, {
                  users: users.length,
                  spells: spells.length,
                  monsters: monsters.length,
                  feats: feats.length,
                  classes: classes.length
                }) === 0 && <p className="empty-state">No entries found.</p>}
              </div>
            </section>

            <section className="admin-pane admin-preview-pane">
              <div className="panel-head">
                <div>
                  <p className="panel-label">Selected</p>
                  <h3>{tab === "users" ? "User preview" : `${singularLabel(tab)} preview`}</h3>
                </div>
                {tab === "users" && selectedUser ? (
                  <div className="admin-row-actions">
                    {selectedUser.isAdmin ? (
                      selectedUser.id !== currentUserId ? (
                        <button type="button" onClick={() => void demoteUser(selectedUser.id)}>
                          Demote
                        </button>
                      ) : null
                    ) : (
                      <button type="button" className="accent-button" onClick={() => void promoteUser(selectedUser.id)}>
                        Promote
                      </button>
                    )}
                  </div>
                ) : null}
              </div>

              {tab === "users" && (selectedUser ? <UserPreviewCard user={selectedUser} /> : <PreviewPlaceholder title="Users" message="Select a user to inspect details and manage access." />)}
              {tab === "spells" && (selectedSpell ? <SpellPreviewCard spell={selectedSpell} /> : <PreviewPlaceholder title="Spells" message="Select a spell to preview it here." />)}
              {tab === "monsters" && (selectedMonster ? <MonsterPreviewCard monster={selectedMonster} /> : <PreviewPlaceholder title="Monsters" message="Select a monster to preview it here." />)}
              {tab === "feats" && (selectedFeat ? <FeatPreviewCard feat={selectedFeat} /> : <PreviewPlaceholder title="Feats" message="Select a feat to preview it here." />)}
              {tab === "classes" && (selectedClass ? <ClassPreviewCard entry={selectedClass} /> : <PreviewPlaceholder title="Classes" message="Select a class to preview it here." />)}
            </section>
          </div>
        ) : mode === "add" ? (
          <div className="admin-content-grid">
            <section className="admin-pane admin-form-pane">
              <div className="panel-head">
                <div>
                  <p className="panel-label">Create</p>
                  <h3>Add {singularLabel(tab)}</h3>
                </div>
              </div>

              {tab === "spells" && (
                <form className="admin-form-grid" onSubmit={handleSpellSubmit}>
                  <Field label="Name"><input value={spellForm.name} onChange={(event) => setSpellForm({ ...spellForm, name: event.target.value })} /></Field>
                  <Field label="Source"><input value={spellForm.source} onChange={(event) => setSpellForm({ ...spellForm, source: event.target.value })} /></Field>
                  <Field label="Level">
                    <select value={spellForm.level} onChange={(event) => setSpellForm({ ...spellForm, level: event.target.value })}>
                      <option value="cantrip">Cantrip</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => (
                        <option key={level} value={level}>
                          Level {level}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="School">
                    <select value={spellForm.school} onChange={(event) => setSpellForm({ ...spellForm, school: event.target.value as SpellEntry["school"] })}>
                      {["Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation"].map((school) => (
                        <option key={school} value={school}>
                          {school}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Casting time unit">
                    <select value={spellForm.castingTimeUnit} onChange={(event) => setSpellForm({ ...spellForm, castingTimeUnit: event.target.value as SpellEntry["castingTimeUnit"] })}>
                      {["action", "bonus action", "minute", "hour"].map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Casting time value"><input value={spellForm.castingTimeValue} onChange={(event) => setSpellForm({ ...spellForm, castingTimeValue: event.target.value })} /></Field>
                  <Field label="Range type">
                    <select value={spellForm.rangeType} onChange={(event) => setSpellForm({ ...spellForm, rangeType: event.target.value as SpellEntry["rangeType"] })}>
                      {["feet", "self", "self emanation", "touch"].map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Range value"><input value={spellForm.rangeValue} onChange={(event) => setSpellForm({ ...spellForm, rangeValue: event.target.value })} /></Field>
                  <Field label="Duration unit">
                    <select value={spellForm.durationUnit} onChange={(event) => setSpellForm({ ...spellForm, durationUnit: event.target.value as SpellEntry["durationUnit"] })}>
                      {["instant", "minute", "hour"].map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Duration value"><input value={spellForm.durationValue} onChange={(event) => setSpellForm({ ...spellForm, durationValue: event.target.value })} /></Field>
                  <Field label="Damage notation"><input value={spellForm.damageNotation} onChange={(event) => setSpellForm({ ...spellForm, damageNotation: event.target.value })} /></Field>
                  <Field label="Damage ability">
                    <select value={spellForm.damageAbility} onChange={(event) => setSpellForm({ ...spellForm, damageAbility: event.target.value as SpellFormState["damageAbility"] })}>
                      <option value="">None</option>
                      {["str", "dex", "con", "int", "wis", "cha"].map((ability) => (
                        <option key={ability} value={ability}>
                          {ability.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Classes" wide><input value={spellForm.classesText} onChange={(event) => setSpellForm({ ...spellForm, classesText: event.target.value })} placeholder="Wizard, Sorcerer" /></Field>
                  <Field label="Short description" wide><textarea value={spellForm.description} onChange={(event) => setSpellForm({ ...spellForm, description: event.target.value })} /></Field>
                  <Field label="Full description" wide><textarea value={spellForm.fullDescription} onChange={(event) => setSpellForm({ ...spellForm, fullDescription: event.target.value })} /></Field>
                  <fieldset className="admin-checks">
                    <legend>Components and flags</legend>
                    <label><input type="checkbox" checked={spellForm.verbal} onChange={(event) => setSpellForm({ ...spellForm, verbal: event.target.checked })} /> Verbal</label>
                    <label><input type="checkbox" checked={spellForm.somatic} onChange={(event) => setSpellForm({ ...spellForm, somatic: event.target.checked })} /> Somatic</label>
                    <label><input type="checkbox" checked={spellForm.material} onChange={(event) => setSpellForm({ ...spellForm, material: event.target.checked })} /> Material</label>
                    <label><input type="checkbox" checked={spellForm.materialConsumed} onChange={(event) => setSpellForm({ ...spellForm, materialConsumed: event.target.checked })} /> Material consumed</label>
                    <label><input type="checkbox" checked={spellForm.concentration} onChange={(event) => setSpellForm({ ...spellForm, concentration: event.target.checked })} /> Concentration</label>
                  </fieldset>
                  <Field label="Material text"><input value={spellForm.materialText} onChange={(event) => setSpellForm({ ...spellForm, materialText: event.target.value })} /></Field>
                  <Field label="Material value"><input value={spellForm.materialValue} onChange={(event) => setSpellForm({ ...spellForm, materialValue: event.target.value })} /></Field>
                  <button className="accent-button" type="submit">Add spell</button>
                </form>
              )}

              {tab === "monsters" && (
                <form className="admin-form-grid admin-form-grid-wide" onSubmit={handleMonsterSubmit}>
                  <Field label="Name"><input value={monsterForm.name} onChange={(event) => setMonsterForm({ ...monsterForm, name: event.target.value })} /></Field>
                  <Field label="Source"><input value={monsterForm.source} onChange={(event) => setMonsterForm({ ...monsterForm, source: event.target.value })} /></Field>
                  <Field label="Challenge rating"><input value={monsterForm.challengeRating} onChange={(event) => setMonsterForm({ ...monsterForm, challengeRating: event.target.value })} /></Field>
                  <Field label="Armor class"><input value={monsterForm.armorClass} onChange={(event) => setMonsterForm({ ...monsterForm, armorClass: event.target.value })} /></Field>
                  <Field label="Hit points"><input value={monsterForm.hitPoints} onChange={(event) => setMonsterForm({ ...monsterForm, hitPoints: event.target.value })} /></Field>
                  <Field label="Experience"><input value={monsterForm.xp} onChange={(event) => setMonsterForm({ ...monsterForm, xp: event.target.value })} /></Field>
                  <Field label="Proficiency bonus"><input value={monsterForm.proficiencyBonus} onChange={(event) => setMonsterForm({ ...monsterForm, proficiencyBonus: event.target.value })} /></Field>
                  <Field label="Passive perception"><input value={monsterForm.passivePerception} onChange={(event) => setMonsterForm({ ...monsterForm, passivePerception: event.target.value })} /></Field>
                  <Field label="Walk speed"><input value={monsterForm.walk} onChange={(event) => setMonsterForm({ ...monsterForm, walk: event.target.value })} /></Field>
                  <Field label="Fly speed"><input value={monsterForm.fly} onChange={(event) => setMonsterForm({ ...monsterForm, fly: event.target.value })} /></Field>
                  <Field label="Burrow speed"><input value={monsterForm.burrow} onChange={(event) => setMonsterForm({ ...monsterForm, burrow: event.target.value })} /></Field>
                  <Field label="Swim speed"><input value={monsterForm.swim} onChange={(event) => setMonsterForm({ ...monsterForm, swim: event.target.value })} /></Field>
                  <Field label="Climb speed"><input value={monsterForm.climb} onChange={(event) => setMonsterForm({ ...monsterForm, climb: event.target.value })} /></Field>
                  <Field label="Strength"><input value={monsterForm.str} onChange={(event) => setMonsterForm({ ...monsterForm, str: event.target.value })} /></Field>
                  <Field label="Dexterity"><input value={monsterForm.dex} onChange={(event) => setMonsterForm({ ...monsterForm, dex: event.target.value })} /></Field>
                  <Field label="Constitution"><input value={monsterForm.con} onChange={(event) => setMonsterForm({ ...monsterForm, con: event.target.value })} /></Field>
                  <Field label="Intelligence"><input value={monsterForm.int} onChange={(event) => setMonsterForm({ ...monsterForm, int: event.target.value })} /></Field>
                  <Field label="Wisdom"><input value={monsterForm.wis} onChange={(event) => setMonsterForm({ ...monsterForm, wis: event.target.value })} /></Field>
                  <Field label="Charisma"><input value={monsterForm.cha} onChange={(event) => setMonsterForm({ ...monsterForm, cha: event.target.value })} /></Field>
                  <Field label="Skills" wide><input value={monsterForm.skillsText} onChange={(event) => setMonsterForm({ ...monsterForm, skillsText: event.target.value })} placeholder="Perception:13, Stealth:6" /></Field>
                  <Field label="Senses" wide><input value={monsterForm.sensesText} onChange={(event) => setMonsterForm({ ...monsterForm, sensesText: event.target.value })} placeholder="Darkvision:120, Blindsight:60" /></Field>
                  <Field label="Languages" wide><input value={monsterForm.languagesText} onChange={(event) => setMonsterForm({ ...monsterForm, languagesText: event.target.value })} placeholder="Common, Draconic" /></Field>
                  <Field label="Gear" wide><input value={monsterForm.gearText} onChange={(event) => setMonsterForm({ ...monsterForm, gearText: event.target.value })} /></Field>
                  <Field label="Resistances" wide><input value={monsterForm.resistancesText} onChange={(event) => setMonsterForm({ ...monsterForm, resistancesText: event.target.value })} /></Field>
                  <Field label="Vulnerabilities" wide><input value={monsterForm.vulnerabilitiesText} onChange={(event) => setMonsterForm({ ...monsterForm, vulnerabilitiesText: event.target.value })} /></Field>
                  <Field label="Immunities" wide><input value={monsterForm.immunitiesText} onChange={(event) => setMonsterForm({ ...monsterForm, immunitiesText: event.target.value })} /></Field>
                  <Field label="Traits" wide><textarea value={monsterForm.traitsText} onChange={(event) => setMonsterForm({ ...monsterForm, traitsText: event.target.value })} placeholder="One trait per line" /></Field>
                  <Field label="Spells" wide><input value={monsterForm.spellsText} onChange={(event) => setMonsterForm({ ...monsterForm, spellsText: event.target.value })} /></Field>
                  <Field label="Actions JSON" wide><textarea value={monsterForm.actionsJson} onChange={(event) => setMonsterForm({ ...monsterForm, actionsJson: event.target.value })} placeholder={JSON.stringify([monsterActionTemplate], null, 2)} /></Field>
                  <Field label="Bonus actions JSON" wide><textarea value={monsterForm.bonusActionsJson} onChange={(event) => setMonsterForm({ ...monsterForm, bonusActionsJson: event.target.value })} /></Field>
                  <Field label="Reactions JSON" wide><textarea value={monsterForm.reactionsJson} onChange={(event) => setMonsterForm({ ...monsterForm, reactionsJson: event.target.value })} /></Field>
                  <Field label="Legendary actions JSON" wide><textarea value={monsterForm.legendaryActionsJson} onChange={(event) => setMonsterForm({ ...monsterForm, legendaryActionsJson: event.target.value })} /></Field>
                  <Field label="Legendary action uses"><input value={monsterForm.legendaryActionsUse} onChange={(event) => setMonsterForm({ ...monsterForm, legendaryActionsUse: event.target.value })} /></Field>
                  <Field label="Lair actions JSON" wide><textarea value={monsterForm.lairActionsJson} onChange={(event) => setMonsterForm({ ...monsterForm, lairActionsJson: event.target.value })} /></Field>
                  <Field label="Regional effects JSON" wide><textarea value={monsterForm.regionalEffectsJson} onChange={(event) => setMonsterForm({ ...monsterForm, regionalEffectsJson: event.target.value })} /></Field>
                  <Field label="Habitat"><input value={monsterForm.habitat} onChange={(event) => setMonsterForm({ ...monsterForm, habitat: event.target.value })} /></Field>
                  <Field label="Treasure"><input value={monsterForm.treasure} onChange={(event) => setMonsterForm({ ...monsterForm, treasure: event.target.value })} /></Field>
                  <Field label="Image URL"><input value={monsterForm.imageUrl} onChange={(event) => setMonsterForm({ ...monsterForm, imageUrl: event.target.value })} /></Field>
                  <Field label="Color" wide>
                    <div className="color-field">
                      <input type="color" value={monsterForm.color} onChange={(event) => setMonsterForm({ ...monsterForm, color: event.target.value })} />
                      <span>{monsterForm.color}</span>
                    </div>
                  </Field>
                  <button className="accent-button" type="submit">Add monster</button>
                </form>
              )}

              {tab === "feats" && (
                <form className="admin-form-grid" onSubmit={handleFeatSubmit}>
                  <Field label="Name"><input value={featForm.name} onChange={(event) => setFeatForm({ ...featForm, name: event.target.value })} /></Field>
                  <Field label="Source"><input value={featForm.source} onChange={(event) => setFeatForm({ ...featForm, source: event.target.value })} /></Field>
                  <Field label="Category"><input value={featForm.category} onChange={(event) => setFeatForm({ ...featForm, category: event.target.value })} /></Field>
                  <Field label="Ability score increase"><input value={featForm.abilityScoreIncrease} onChange={(event) => setFeatForm({ ...featForm, abilityScoreIncrease: event.target.value })} /></Field>
                  <Field label="Prerequisites" wide><input value={featForm.prerequisites} onChange={(event) => setFeatForm({ ...featForm, prerequisites: event.target.value })} /></Field>
                  <Field label="Description" wide><textarea value={featForm.description} onChange={(event) => setFeatForm({ ...featForm, description: event.target.value })} /></Field>
                  <button className="accent-button" type="submit">Add feat</button>
                </form>
              )}

              {tab === "classes" && (
                <form className="admin-form-grid" onSubmit={handleClassSubmit}>
                  <Field label="Name"><input value={classForm.name} onChange={(event) => setClassForm({ ...classForm, name: event.target.value })} /></Field>
                  <Field label="Source"><input value={classForm.source} onChange={(event) => setClassForm({ ...classForm, source: event.target.value })} /></Field>
                  <Field label="Description" wide><textarea value={classForm.description} onChange={(event) => setClassForm({ ...classForm, description: event.target.value })} /></Field>
                  <Field label="Features JSON" wide><textarea value={classForm.featuresJson} onChange={(event) => setClassForm({ ...classForm, featuresJson: event.target.value })} /></Field>
                  <Field label="Tables JSON" wide><textarea value={classForm.tablesJson} onChange={(event) => setClassForm({ ...classForm, tablesJson: event.target.value })} /></Field>
                  <button className="accent-button" type="submit">Add class</button>
                </form>
              )}
            </section>

            <section className="admin-pane admin-preview-pane">
              <div className="panel-head">
                <div>
                  <p className="panel-label">Draft</p>
                  <h3>{singularLabel(tab)} preview</h3>
                </div>
              </div>
              {tab === "spells" && (spellPreview.entry ? <SpellPreviewCard spell={spellPreview.entry} /> : <PreviewError title="Spell" message={spellPreview.error ?? "Fill in the form to preview the spell."} />)}
              {tab === "monsters" && (monsterPreview.entry ? <MonsterPreviewCard monster={monsterPreview.entry} /> : <PreviewError title="Monster" message={monsterPreview.error ?? "Fill in the form to preview the monster."} />)}
              {tab === "feats" && (featPreview.entry ? <FeatPreviewCard feat={featPreview.entry} /> : <PreviewError title="Feat" message={featPreview.error ?? "Fill in the form to preview the feat."} />)}
              {tab === "classes" && (classPreview.entry ? <ClassPreviewCard entry={classPreview.entry} /> : <PreviewError title="Class" message={classPreview.error ?? "Fill in the form to preview the class."} />)}
            </section>
          </div>
        ) : (
          <div className="admin-content-grid">
            <section className="admin-pane admin-form-pane">
              <div className="panel-head">
                <div>
                  <p className="panel-label">Import</p>
                  <h3>{labelForTab(tab)} JSON</h3>
                </div>
                <button
                  type="button"
                  className="accent-button"
                  onClick={() => {
                    if (activeCompendiumTab) {
                      void importEntries(activeCompendiumTab);
                    }
                  }}
                  disabled={!activeCompendiumTab || !jsonImport[activeCompendiumTab].trim()}
                >
                  Import
                </button>
              </div>
              <label className="admin-search-field">
                <span>JSON payload</span>
                <textarea
                  className="admin-json"
                  value={activeCompendiumTab ? jsonImport[activeCompendiumTab] : ""}
                  onChange={(event) => {
                    if (!activeCompendiumTab) {
                      return;
                    }

                    setJsonImport((current) => ({ ...current, [activeCompendiumTab]: event.target.value }));
                  }}
                  placeholder={`Paste one ${singularLabel(tab).toLowerCase()} object or an array of ${labelForTab(tab).toLowerCase()}.`}
                />
              </label>
              <label className="admin-search-field">
                <span>Example JSON</span>
                <textarea className="admin-json admin-json-example" value={importExample} readOnly />
              </label>
            </section>

            <section className="admin-pane admin-preview-pane">
              <div className="panel-head">
                <div>
                  <p className="panel-label">Import status</p>
                  <h3>{singularLabel(tab)} import</h3>
                </div>
              </div>
              {importSummary?.valid ? (
                <PreviewPlaceholder title="Ready" message={importSummary.message} />
              ) : (
                <PreviewError title="Import" message={importSummary?.message ?? "Paste JSON to validate the import payload."} />
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

function Field({
  label,
  wide,
  children
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`admin-field${wide ? " admin-field-wide" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function filterEntries<T>(entries: T[], query: string, project: (entry: T) => string[]) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return entries;
  }

  return entries.filter((entry) => project(entry).some((value) => value.toLowerCase().includes(normalized)));
}

function resolveSelected<T extends { id: string }>(entries: T[], selectedId: string | null) {
  return entries.find((entry) => entry.id === selectedId) ?? entries[0] ?? null;
}

function buildPreview<T>(builder: () => T): PreviewState<T> {
  try {
    return {
      entry: builder(),
      error: null
    };
  } catch (error) {
    return {
      entry: null,
      error: toErrorMessage(error)
    };
  }
}

function labelForTab(tab: AdminTab) {
  switch (tab) {
    case "users":
      return "Users";
    case "spells":
      return "Spells";
    case "monsters":
      return "Monsters";
    case "feats":
      return "Feats";
    case "classes":
      return "Classes";
  }
}

function singularLabel(tab: AdminTab) {
  if (tab === "users") {
    return "User";
  }

  switch (tab) {
    case "spells":
      return "Spell";
    case "monsters":
      return "Monster";
    case "feats":
      return "Feat";
    case "classes":
      return "Class";
  }
}

function countForTab(tab: AdminTab, counts: Record<AdminTab, number>) {
  return counts[tab];
}

function getImportExample(tab: CompendiumTab) {
  switch (tab) {
    case "spells":
      return JSON.stringify(
        [
          {
            name: "Acid Splash",
            source: "PHB'24",
            level: "cantrip",
            school: "Evocation",
            castingTimeUnit: "action",
            castingTimeValue: 1,
            rangeType: "feet",
            rangeValue: 60,
            description: "You create an acidic bubble at a point within range.",
            components: {
              verbal: true,
              somatic: true,
              material: false,
              materialText: "",
              materialValue: 0,
              materialConsumed: false
            },
            durationUnit: "instant",
            durationValue: 0,
            concentration: false,
            damageNotation: "1d6",
            damageAbility: null,
            fullDescription: "A target in a 5-foot-radius Sphere must make a Dexterity saving throw or take Acid damage.",
            classes: ["Artificer", "Sorcerer", "Wizard"]
          }
        ],
        null,
        2
      );
    case "monsters":
      return JSON.stringify(
        [
          {
            name: "Adult Red Dragon",
            source: "MM'25",
            challengeRating: "17",
            armorClass: 19,
            hitPoints: 256,
            speed: 40,
            speedModes: { walk: 40, fly: 80, burrow: 0, swim: 0, climb: 40 },
            abilities: { str: 27, dex: 10, con: 25, int: 16, wis: 13, cha: 21 },
            skills: [{ name: "Perception", bonus: 13 }, { name: "Stealth", bonus: 6 }],
            senses: [{ name: "Blindsight", range: 60, notes: "" }, { name: "Darkvision", range: 120, notes: "" }],
            passivePerception: 23,
            languages: ["Common", "Draconic"],
            xp: 18000,
            proficiencyBonus: 6,
            gear: [],
            resistances: [],
            vulnerabilities: [],
            immunities: ["Fire"],
            traits: ["Legendary Resistance (3/Day). If the dragon fails a saving throw, it can choose to succeed instead."],
            actions: [
              {
                name: "Rend",
                description: "Melee Attack Roll: +14, reach 10 ft. Hit: 13 (1d10 + 8) Slashing damage plus 5 (2d4) Fire damage.",
                damage: "1d10+8 + 2d4",
                attackType: "melee",
                attackBonus: 14,
                reachOrRange: "reach 10 ft.",
                damageType: "slashing + fire"
              }
            ],
            bonusActions: [],
            reactions: [],
            legendaryActions: [],
            legendaryActionsUse: 3,
            lairActions: [],
            regionalEffects: [],
            spells: ["Command", "Detect Magic", "Scorching Ray"],
            habitat: "Volcanic mountains",
            treasure: "Hoard",
            imageUrl: "",
            color: "#9a5546"
          }
        ],
        null,
        2
      );
    case "feats":
      return JSON.stringify(
        [
          {
            name: "Spell Sniper",
            source: "PHB'24",
            category: "General Feat",
            abilityScoreIncrease: "Increase your Intelligence, Wisdom, or Charisma by 1, to a maximum of 20.",
            prerequisites: "Level 4+; Spellcasting or Pact Magic Feature",
            description: "Your attack rolls for spells ignore Half Cover and Three-Quarters Cover, and your spell range increases by 60 feet when appropriate."
          }
        ],
        null,
        2
      );
    case "classes":
      return JSON.stringify(
        [
          {
            name: "Barbarian",
            source: "PHB'24",
            description: "A fierce warrior of primal power and relentless endurance.",
            features: [
              { level: 1, name: "Rage", description: "Enter a rage as a Bonus Action." },
              { level: 1, name: "Unarmored Defense", description: "Your AC equals 10 + Dex + Con when unarmored." }
            ],
            tables: [
              {
                name: "Barbarian Progression",
                columns: ["Level", "Proficiency Bonus", "Features", "Rages"],
                rows: [
                  ["1st", "+2", "Rage, Unarmored Defense", "2"],
                  ["2nd", "+2", "Danger Sense, Reckless Attack", "2"]
                ]
              }
            ]
          }
        ],
        null,
        2
      );
  }
}
