import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { ArrowDownToLine, FilePlus2, List, RefreshCw } from "lucide-react";

import type { SpellEntry } from "@shared/types";
import { ClassPreviewCard, FeatPreviewCard, MonsterPreviewCard, PreviewError, PreviewPlaceholder, SpellPreviewCard, UserPreviewCard } from "./admin/AdminPreview";
import styles from "./AdminPanel.module.css";
import { useAdminOverviewQuery } from "../features/admin/useAdminOverviewQuery";
import {
  clearCompendiumItems,
  createCompendiumItem,
  deleteAdminUser,
  deleteCompendiumItem,
  demoteAdminUser,
  importCompendiumItems,
  promoteAdminUser
} from "../features/admin/adminService";
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
import { readFileAsDataUrl } from "../lib/media";
import {
  AdminField,
  buildPreview,
  countForTab,
  filterEntries,
  getImportExample,
  labelForTab,
  resolveSelected,
  singularLabel,
  tabIcons,
  type AdminTab,
  type CompendiumTab
} from "./admin/adminPanelUtils";

type AdminMode = "list" | "add" | "import";
const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");

interface AdminPanelProps {
  token: string;
  currentUserId: string;
  onStatus: (tone: "info" | "error", text: string) => void;
}

export function AdminPanel({ token, currentUserId, onStatus }: AdminPanelProps) {
  const [tab, setTab] = useState<AdminTab>("users");
  const [mode, setMode] = useState<AdminMode>("list");
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
  const [importFiles, setImportFiles] = useState<Record<CompendiumTab, { name: string; content: string } | null>>({
    spells: null,
    monsters: null,
    feats: null,
    classes: null
  });
  const [spellForm, setSpellForm] = useState<SpellFormState>(createSpellForm());
  const [monsterForm, setMonsterForm] = useState<MonsterFormState>(createMonsterForm());
  const [featForm, setFeatForm] = useState<FeatFormState>(createFeatForm());
  const [classForm, setClassForm] = useState<ClassFormState>(createClassForm());
  const activeCompendiumTab: CompendiumTab | null = tab === "users" ? null : tab;

  const { overview, isLoading: loading, refreshOverview } = useAdminOverviewQuery({
    token,
    onError: (message) => onStatus("error", message)
  });

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

    const file = importFiles[activeCompendiumTab];
    const value = file?.content ?? "";

    if (!value.trim()) {
      return { valid: false, message: "Upload one JSON file containing one object or an array." };
    }

    try {
      const parsed = JSON.parse(value) as unknown;
      const count = resolveImportEntryCount(activeCompendiumTab, parsed);
      const isSpellLookup = activeCompendiumTab === "spells" && isGeneratedSpellLookupPayload(parsed);
      return {
        valid: true,
        message: isSpellLookup
          ? `${count} spell class lookups ready to apply to imported spells.`
          : `${count} ${count === 1 ? singularLabel(activeCompendiumTab) : labelForTab(activeCompendiumTab)} ready to import.`
      };
    } catch (error) {
      return { valid: false, message: toErrorMessage(error) };
    }
  }, [activeCompendiumTab, importFiles]);
  const importExample = useMemo(
    () => (activeCompendiumTab ? getImportExample(activeCompendiumTab) : ""),
    [activeCompendiumTab]
  );

  async function promoteUser(userId: string) {
    try {
      await promoteAdminUser(token, userId);
      onStatus("info", "User promoted to administrator.");
      await refreshOverview();
    } catch (error) {
      onStatus("error", toErrorMessage(error));
    }
  }

  async function demoteUser(userId: string) {
    try {
      await demoteAdminUser(token, userId);
      onStatus("info", "User demoted.");
      await refreshOverview();
    } catch (error) {
      onStatus("error", toErrorMessage(error));
    }
  }

  async function removeUser(userId: string) {
    try {
      await deleteAdminUser(token, userId);
      setSelectedIds((current) => ({ ...current, users: null }));
      onStatus("info", "User deleted.");
      await refreshOverview();
    } catch (error) {
      onStatus("error", toErrorMessage(error));
    }
  }

  async function createEntry(kind: CompendiumTab, entry: unknown, reset: () => void) {
    try {
      const created = await createCompendiumItem(token, kind, entry);

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
      const file = importFiles[kind];

      if (!file?.content.trim()) {
        throw new Error("Upload a JSON file first.");
      }

      const payload = JSON.parse(file.content) as unknown;
      await importCompendiumItems(token, kind, payload);

      setImportFiles((current) => ({ ...current, [kind]: null }));
      setMode("list");
      onStatus("info", `${labelForTab(kind)} import completed.`);
      await refreshOverview();
    } catch (error) {
      onStatus("error", toErrorMessage(error));
    }
  }

  async function removeCompendiumEntry(kind: CompendiumTab, itemId: string) {
    try {
      await deleteCompendiumItem(token, kind, itemId);
      setSelectedIds((current) => ({ ...current, [kind]: null }));
      onStatus("info", `${singularLabel(kind)} deleted.`);
      await refreshOverview();
    } catch (error) {
      onStatus("error", toErrorMessage(error));
    }
  }

  async function clearCompendium(kind: CompendiumTab) {
    if (!window.confirm(`Clear all ${labelForTab(kind).toLowerCase()}? This cannot be undone.`)) {
      return;
    }

    try {
      await clearCompendiumItems(token, kind);
      setSelectedIds((current) => ({ ...current, [kind]: null }));
      onStatus("info", `${labelForTab(kind)} cleared.`);
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

  async function handleMonsterImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const imageUrl = await readFileAsDataUrl(file);
      setMonsterForm((current) => ({ ...current, imageUrl }));
    } catch (error) {
      onStatus("error", toErrorMessage(error));
    }
  }

  async function handleImportFileChange(kind: CompendiumTab, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      setImportFiles((current) => ({
        ...current,
        [kind]: {
          name: file.name,
          content
        }
      }));
    } catch (error) {
      onStatus("error", toErrorMessage(error));
    }
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
    <main className={styles.page}>
      <section className={styles.shell}>
        <div className={styles.head}>
          <div>
            <p className="panel-label">System</p>
            <h2>Administrator area</h2>
          </div>
          <button type="button" onClick={() => void refreshOverview()} disabled={loading}>
            <RefreshCw size={15} />
            <span>{loading ? "Refreshing" : "Refresh"}</span>
          </button>
        </div>

        <div className={styles.staticShell}>
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

            {tab !== "users" ? (
              <div className={styles.modeTabs}>
                <button type="button" className={cx(styles.modeTab, mode === "list" && styles.modeTabActive)} onClick={() => setMode("list")}>
                  <List size={15} />
                  <span>List</span>
                </button>
                <button type="button" className={cx(styles.modeTab, mode === "add" && styles.modeTabActive)} onClick={() => setMode("add")}>
                  <FilePlus2 size={15} />
                  <span>Add</span>
                </button>
                <button type="button" className={cx(styles.modeTab, mode === "import" && styles.modeTabActive)} onClick={() => setMode("import")}>
                  <ArrowDownToLine size={15} />
                  <span>Import</span>
                </button>
              </div>
            ) : null}
          </div>

          <div className={styles.upperGrid}>
            <section className="admin-pane admin-list-pane">
              <div className="panel-head">
                <div>
                  <p className="panel-label">Library</p>
                  <h3>{labelForTab(tab)}</h3>
                </div>
                <div className="admin-row-actions">
                  <span className="badge subtle">{countForTab(tab, counts)}</span>
                  {tab !== "users" ? (
                    <button
                      type="button"
                      className="danger-button"
                      disabled={countForTab(tab, counts) === 0}
                      onClick={() => void clearCompendium(tab)}
                    >
                      Clear all
                    </button>
                  ) : null}
                </div>
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
                    <button type="button" className="danger-button" onClick={() => void removeUser(selectedUser.id)}>
                      Delete
                    </button>
                  </div>
                ) : tab !== "users" ? (
                  <div className="admin-row-actions">
                    {tab === "spells" && selectedSpell ? (
                      <button type="button" className="danger-button" onClick={() => void removeCompendiumEntry("spells", selectedSpell.id)}>
                        Delete
                      </button>
                    ) : null}
                    {tab === "monsters" && selectedMonster ? (
                      <button type="button" className="danger-button" onClick={() => void removeCompendiumEntry("monsters", selectedMonster.id)}>
                        Delete
                      </button>
                    ) : null}
                    {tab === "feats" && selectedFeat ? (
                      <button type="button" className="danger-button" onClick={() => void removeCompendiumEntry("feats", selectedFeat.id)}>
                        Delete
                      </button>
                    ) : null}
                    {tab === "classes" && selectedClass ? (
                      <button type="button" className="danger-button" onClick={() => void removeCompendiumEntry("classes", selectedClass.id)}>
                        Delete
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {tab === "users" && (selectedUser ? <UserPreviewCard user={selectedUser} /> : <PreviewPlaceholder title="Users" message="Select a user to inspect details and manage access." />)}
              {tab === "spells" && (selectedSpell ? <SpellPreviewCard spell={selectedSpell} featEntries={overview?.compendium.feats ?? []} classEntries={overview?.compendium.classes ?? []} /> : <PreviewPlaceholder title="Spells" message="Select a spell to preview it here." />)}
              {tab === "monsters" && (selectedMonster ? <MonsterPreviewCard monster={selectedMonster} spellEntries={overview?.compendium.spells ?? []} featEntries={overview?.compendium.feats ?? []} classEntries={overview?.compendium.classes ?? []} /> : <PreviewPlaceholder title="Monsters" message="Select a monster to preview it here." />)}
              {tab === "feats" && (selectedFeat ? <FeatPreviewCard feat={selectedFeat} spellEntries={overview?.compendium.spells ?? []} classEntries={overview?.compendium.classes ?? []} /> : <PreviewPlaceholder title="Feats" message="Select a feat to preview it here." />)}
              {tab === "classes" && (selectedClass ? <ClassPreviewCard entry={selectedClass} spellEntries={overview?.compendium.spells ?? []} featEntries={overview?.compendium.feats ?? []} /> : <PreviewPlaceholder title="Classes" message="Select a class to preview it here." />)}
            </section>
          </div>
          {tab !== "users" ? (
            <section className={cx(styles.lowerShell, "admin-pane")}>
              <div className={styles.lowerHead}>
                <div>
                  <p className="panel-label">{mode === "add" ? "Create" : mode === "import" ? "Import" : "Browse"}</p>
                  <h3>
                    {mode === "add"
                      ? `Add ${singularLabel(tab)}`
                      : mode === "import"
                        ? `Import ${labelForTab(tab)}`
                        : `${labelForTab(tab)} tools`}
                  </h3>
                </div>
                {mode === "import" ? (
                  <button
                    type="button"
                    className="accent-button"
                    onClick={() => {
                      if (activeCompendiumTab) {
                        void importEntries(activeCompendiumTab);
                      }
                    }}
                    disabled={!activeCompendiumTab || !importFiles[activeCompendiumTab]?.content.trim()}
                  >
                    Import
                  </button>
                ) : null}
              </div>

              {mode === "list" ? (
                <PreviewPlaceholder title="Compendium tools" message="Use Add or Import to create new entries. The selected item preview stays visible above." />
              ) : mode === "add" ? (
                <div className={styles.workspaceGrid}>
                  <section className="admin-form-pane">
                    {tab === "spells" && (
                      <form className="admin-form-grid" onSubmit={handleSpellSubmit}>
                        <AdminField label="Name"><input value={spellForm.name} onChange={(event) => setSpellForm({ ...spellForm, name: event.target.value })} /></AdminField>
                        <AdminField label="Source"><input value={spellForm.source} onChange={(event) => setSpellForm({ ...spellForm, source: event.target.value })} /></AdminField>
                        <AdminField label="Level">
                          <select value={spellForm.level} onChange={(event) => setSpellForm({ ...spellForm, level: event.target.value })}>
                            <option value="cantrip">Cantrip</option>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => (
                              <option key={level} value={level}>
                                Level {level}
                              </option>
                            ))}
                          </select>
                        </AdminField>
                        <AdminField label="School">
                          <select value={spellForm.school} onChange={(event) => setSpellForm({ ...spellForm, school: event.target.value as SpellEntry["school"] })}>
                            {["Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation"].map((school) => (
                              <option key={school} value={school}>
                                {school}
                              </option>
                            ))}
                          </select>
                        </AdminField>
                        <AdminField label="Casting time unit">
                          <select value={spellForm.castingTimeUnit} onChange={(event) => setSpellForm({ ...spellForm, castingTimeUnit: event.target.value as SpellEntry["castingTimeUnit"] })}>
                            {["action", "bonus action", "minute", "hour"].map((unit) => (
                              <option key={unit} value={unit}>
                                {unit}
                              </option>
                            ))}
                          </select>
                        </AdminField>
                        <AdminField label="Casting time value"><input value={spellForm.castingTimeValue} onChange={(event) => setSpellForm({ ...spellForm, castingTimeValue: event.target.value })} /></AdminField>
                        <AdminField label="Range type">
                          <select value={spellForm.rangeType} onChange={(event) => setSpellForm({ ...spellForm, rangeType: event.target.value as SpellEntry["rangeType"] })}>
                            {["feet", "self", "self emanation", "touch"].map((unit) => (
                              <option key={unit} value={unit}>
                                {unit}
                              </option>
                            ))}
                          </select>
                        </AdminField>
                        <AdminField label="Range value"><input value={spellForm.rangeValue} onChange={(event) => setSpellForm({ ...spellForm, rangeValue: event.target.value })} /></AdminField>
                        <AdminField label="Duration unit">
                          <select value={spellForm.durationUnit} onChange={(event) => setSpellForm({ ...spellForm, durationUnit: event.target.value as SpellEntry["durationUnit"] })}>
                            {["instant", "minute", "hour"].map((unit) => (
                              <option key={unit} value={unit}>
                                {unit}
                              </option>
                            ))}
                          </select>
                        </AdminField>
                        <AdminField label="Duration value"><input value={spellForm.durationValue} onChange={(event) => setSpellForm({ ...spellForm, durationValue: event.target.value })} /></AdminField>
                        <AdminField label="Damage notation"><input value={spellForm.damageNotation} onChange={(event) => setSpellForm({ ...spellForm, damageNotation: event.target.value })} /></AdminField>
                        <AdminField label="Damage ability">
                          <select value={spellForm.damageAbility} onChange={(event) => setSpellForm({ ...spellForm, damageAbility: event.target.value as SpellFormState["damageAbility"] })}>
                            <option value="">None</option>
                            {["str", "dex", "con", "int", "wis", "cha"].map((ability) => (
                              <option key={ability} value={ability}>
                                {ability.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </AdminField>
                        <AdminField label="Classes" wide><input value={spellForm.classesText} onChange={(event) => setSpellForm({ ...spellForm, classesText: event.target.value })} placeholder="Wizard, Sorcerer" /></AdminField>
                        <AdminField label="Short description" wide><textarea value={spellForm.description} onChange={(event) => setSpellForm({ ...spellForm, description: event.target.value })} /></AdminField>
                        <AdminField label="Full description" wide><textarea value={spellForm.fullDescription} onChange={(event) => setSpellForm({ ...spellForm, fullDescription: event.target.value })} /></AdminField>
                        <fieldset className="admin-checks">
                          <legend>Components and flags</legend>
                          <label><input type="checkbox" checked={spellForm.verbal} onChange={(event) => setSpellForm({ ...spellForm, verbal: event.target.checked })} /> Verbal</label>
                          <label><input type="checkbox" checked={spellForm.somatic} onChange={(event) => setSpellForm({ ...spellForm, somatic: event.target.checked })} /> Somatic</label>
                          <label><input type="checkbox" checked={spellForm.material} onChange={(event) => setSpellForm({ ...spellForm, material: event.target.checked })} /> Material</label>
                          <label><input type="checkbox" checked={spellForm.materialConsumed} onChange={(event) => setSpellForm({ ...spellForm, materialConsumed: event.target.checked })} /> Material consumed</label>
                          <label><input type="checkbox" checked={spellForm.concentration} onChange={(event) => setSpellForm({ ...spellForm, concentration: event.target.checked })} /> Concentration</label>
                        </fieldset>
                        <AdminField label="Material text"><input value={spellForm.materialText} onChange={(event) => setSpellForm({ ...spellForm, materialText: event.target.value })} /></AdminField>
                        <AdminField label="Material value"><input value={spellForm.materialValue} onChange={(event) => setSpellForm({ ...spellForm, materialValue: event.target.value })} /></AdminField>
                        <button className="accent-button" type="submit">Add spell</button>
                      </form>
                    )}

                    {tab === "monsters" && (
                      <form className="admin-form-grid admin-form-grid-wide" onSubmit={handleMonsterSubmit}>
                        <AdminField label="Name"><input value={monsterForm.name} onChange={(event) => setMonsterForm({ ...monsterForm, name: event.target.value })} /></AdminField>
                        <Field label="Source"><input value={monsterForm.source} onChange={(event) => setMonsterForm({ ...monsterForm, source: event.target.value })} /></Field>
                        <Field label="Challenge rating"><input value={monsterForm.challengeRating} onChange={(event) => setMonsterForm({ ...monsterForm, challengeRating: event.target.value })} /></Field>
                        <Field label="Armor class"><input value={monsterForm.armorClass} onChange={(event) => setMonsterForm({ ...monsterForm, armorClass: event.target.value })} /></Field>
                        <Field label="Hit points"><input value={monsterForm.hitPoints} onChange={(event) => setMonsterForm({ ...monsterForm, hitPoints: event.target.value })} /></Field>
                        <Field label="Initiative"><input value={monsterForm.initiative} onChange={(event) => setMonsterForm({ ...monsterForm, initiative: event.target.value })} /></Field>
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
                        <Field label="Image URL">
                          <input value={monsterForm.imageUrl} onChange={(event) => setMonsterForm({ ...monsterForm, imageUrl: event.target.value })} />
                        </Field>
                        <Field label="Upload image">
                          <div className="admin-image-controls">
                            <input type="file" accept="image/*" onChange={(event) => void handleMonsterImageUpload(event)} />
                            <button type="button" onClick={() => setMonsterForm({ ...monsterForm, imageUrl: "" })} disabled={!monsterForm.imageUrl}>
                              Clear image
                            </button>
                          </div>
                        </Field>
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
                        <AdminField label="Name"><input value={featForm.name} onChange={(event) => setFeatForm({ ...featForm, name: event.target.value })} /></AdminField>
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
                        <AdminField label="Name"><input value={classForm.name} onChange={(event) => setClassForm({ ...classForm, name: event.target.value })} /></AdminField>
                        <Field label="Source"><input value={classForm.source} onChange={(event) => setClassForm({ ...classForm, source: event.target.value })} /></Field>
                        <Field label="Description" wide><textarea value={classForm.description} onChange={(event) => setClassForm({ ...classForm, description: event.target.value })} /></Field>
                        <Field label="Features JSON" wide><textarea value={classForm.featuresJson} onChange={(event) => setClassForm({ ...classForm, featuresJson: event.target.value })} /></Field>
                        <Field label="Tables JSON" wide><textarea value={classForm.tablesJson} onChange={(event) => setClassForm({ ...classForm, tablesJson: event.target.value })} /></Field>
                        <button className="accent-button" type="submit">Add class</button>
                      </form>
                    )}
                  </section>

                  <section className="admin-preview-pane">
                    <div className="panel-head">
                      <div>
                        <p className="panel-label">Draft</p>
                        <h3>{singularLabel(tab)} preview</h3>
                      </div>
                    </div>
                    {tab === "spells" && (spellPreview.entry ? <SpellPreviewCard spell={spellPreview.entry} featEntries={overview?.compendium.feats ?? []} classEntries={overview?.compendium.classes ?? []} /> : <PreviewError title="Spell" message={spellPreview.error ?? "Fill in the form to preview the spell."} />)}
                    {tab === "monsters" && (monsterPreview.entry ? <MonsterPreviewCard monster={monsterPreview.entry} spellEntries={overview?.compendium.spells ?? []} featEntries={overview?.compendium.feats ?? []} classEntries={overview?.compendium.classes ?? []} /> : <PreviewError title="Monster" message={monsterPreview.error ?? "Fill in the form to preview the monster."} />)}
                    {tab === "feats" && (featPreview.entry ? <FeatPreviewCard feat={featPreview.entry} spellEntries={overview?.compendium.spells ?? []} classEntries={overview?.compendium.classes ?? []} /> : <PreviewError title="Feat" message={featPreview.error ?? "Fill in the form to preview the feat."} />)}
                    {tab === "classes" && (classPreview.entry ? <ClassPreviewCard entry={classPreview.entry} spellEntries={overview?.compendium.spells ?? []} featEntries={overview?.compendium.feats ?? []} /> : <PreviewError title="Class" message={classPreview.error ?? "Fill in the form to preview the class."} />)}
                  </section>
                </div>
              ) : (
                <div className={styles.workspaceGrid}>
                  <section className="admin-form-pane">
                    <label className="admin-search-field">
                      <span>JSON file</span>
                      <div className="admin-import-upload">
                        <input
                          type="file"
                          accept="application/json,.json"
                          onChange={(event) => {
                            if (!activeCompendiumTab) {
                              return;
                            }

                            void handleImportFileChange(activeCompendiumTab, event);
                          }}
                        />
                        <div className="admin-import-file-meta">
                          <strong>{activeCompendiumTab ? importFiles[activeCompendiumTab]?.name ?? "No file selected" : "No file selected"}</strong>
                          <small>
                            {activeCompendiumTab && importFiles[activeCompendiumTab]?.content
                              ? `${importFiles[activeCompendiumTab]?.content.length.toLocaleString()} characters loaded`
                              : `Upload one ${singularLabel(tab).toLowerCase()} object or an array of ${labelForTab(tab).toLowerCase()}.`}
                          </small>
                          {tab === "spells" ? (
                            <small>Accepted spell files: raw 5etools `spell` JSON or `gendata-spell-source-lookup.json` to enrich imported spells with class references.</small>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!activeCompendiumTab) {
                              return;
                            }

                            setImportFiles((current) => ({ ...current, [activeCompendiumTab]: null }));
                          }}
                          disabled={!activeCompendiumTab || !importFiles[activeCompendiumTab]}
                        >
                          Clear file
                        </button>
                      </div>
                    </label>
                    <label className="admin-search-field">
                      <span>Example JSON</span>
                      <textarea className="admin-json admin-json-example" value={importExample} readOnly />
                    </label>
                  </section>

                  <section className="admin-preview-pane">
                    <div className="panel-head">
                      <div>
                        <p className="panel-label">Import status</p>
                        <h3>{singularLabel(tab)} import</h3>
                      </div>
                    </div>
                    {importSummary?.valid ? (
                      <PreviewPlaceholder title="Ready" message={importSummary.message} />
                    ) : (
                      <PreviewError title="Import" message={importSummary?.message ?? "Upload a JSON file to validate the import payload."} />
                    )}
                  </section>
                </div>
              )}
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}

const Field = AdminField;

function resolveImportEntryCount(kind: CompendiumTab, parsed: unknown) {
  if (Array.isArray(parsed)) {
    return parsed.length;
  }

  if (typeof parsed === "object" && parsed !== null) {
    const record = parsed as Record<string, unknown>;

    if (kind === "monsters" && Array.isArray(record.monster)) {
      return record.monster.length;
    }

    if (kind === "spells" && Array.isArray(record.spell)) {
      return record.spell.length;
    }

    if (kind === "spells" && isGeneratedSpellLookupPayload(record)) {
      return countGeneratedSpellLookupEntries(record);
    }

    if (kind === "feats" && Array.isArray(record.feat)) {
      return record.feat.length;
    }

    if (kind === "classes" && Array.isArray(record.class)) {
      return record.class.length;
    }
  }

  return 1;
}

function isGeneratedSpellLookupPayload(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).some((spellBucket) => {
    if (typeof spellBucket !== "object" || spellBucket === null || Array.isArray(spellBucket)) {
      return false;
    }

    return Object.values(spellBucket).some((lookupEntry) => {
      if (typeof lookupEntry !== "object" || lookupEntry === null || Array.isArray(lookupEntry)) {
        return false;
      }

      return ["class", "classVariant", "subclass", "subclassVariant"].some((key) => key in lookupEntry);
    });
  });
}

function countGeneratedSpellLookupEntries(value: Record<string, unknown>) {
  let count = 0;

  Object.values(value).forEach((spellBucket) => {
    if (typeof spellBucket !== "object" || spellBucket === null || Array.isArray(spellBucket)) {
      return;
    }

    Object.values(spellBucket).forEach((lookupEntry) => {
      if (typeof lookupEntry !== "object" || lookupEntry === null || Array.isArray(lookupEntry)) {
        return;
      }

      if (["class", "classVariant", "subclass", "subclassVariant"].some((key) => key in lookupEntry)) {
        count += 1;
      }
    });
  });

  return count;
}
