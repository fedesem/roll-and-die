import { useEffect, useMemo, useState, type ChangeEvent, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { ArrowDownToLine, FilePlus2, List, RefreshCw } from "lucide-react";

import type { CampaignSourceBook, CompendiumReferenceEntry, SpellEntry } from "@shared/types";
import {
  BookPreviewCard,
  ClassPreviewCard,
  FeatPreviewCard,
  MonsterPreviewCard,
  PreviewPlaceholder,
  ReferencePreviewCard,
  SpellPreviewCard,
  UserPreviewCard
} from "./admin/AdminPreview";
import styles from "./AdminPanel.module.css";
import { useAdminOverviewQuery } from "../features/admin/useAdminOverviewQuery";
import {
  clearCompendiumItems,
  createCompendiumItem,
  deleteAdminUser,
  deleteCompendiumItem,
  demoteAdminUser,
  importMonsterTokenArchive,
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
import { uploadImageAsset } from "../services/assetService";
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
type ListSort =
  | "name-asc"
  | "name-desc"
  | "source-asc"
  | "source-desc"
  | "category-asc"
  | "category-desc"
  | "published-desc"
  | "published-asc"
  | "level-asc"
  | "level-desc"
  | "cr-asc"
  | "cr-desc";
interface ListControlsState {
  source: string;
  type: string;
  secondaryType: string;
  sort: ListSort;
}

const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");

interface AdminPanelProps {
  token: string;
  currentUserId: string;
  onStatus: (tone: "info" | "error", text: string) => void;
  onRefreshSourceBooks?: () => Promise<void>;
}

export function AdminPanel({ token, currentUserId, onStatus, onRefreshSourceBooks }: AdminPanelProps) {
  const [tab, setTab] = useState<AdminTab>("users");
  const [mode, setMode] = useState<AdminMode>("list");
  const [search, setSearch] = useState<Record<AdminTab, string>>({
    users: "",
    spells: "",
    monsters: "",
    feats: "",
    classes: "",
    books: "",
    variantRules: "",
    conditions: "",
    optionalFeatures: "",
    actions: "",
    backgrounds: "",
    items: "",
    languages: "",
    races: "",
    skills: ""
  });
  const [selectedIds, setSelectedIds] = useState<Record<AdminTab, string | null>>({
    users: null,
    spells: null,
    monsters: null,
    feats: null,
    classes: null,
    books: null,
    variantRules: null,
    conditions: null,
    optionalFeatures: null,
    actions: null,
    backgrounds: null,
    items: null,
    languages: null,
    races: null,
    skills: null
  });
  const [listControls, setListControls] = useState<Record<AdminTab, ListControlsState>>({
    users: { source: "", type: "", secondaryType: "", sort: "name-asc" },
    spells: { source: "", type: "", secondaryType: "", sort: "name-asc" },
    monsters: { source: "", type: "", secondaryType: "", sort: "name-asc" },
    feats: { source: "", type: "", secondaryType: "", sort: "name-asc" },
    classes: { source: "", type: "", secondaryType: "", sort: "name-asc" },
    books: { source: "", type: "", secondaryType: "", sort: "published-desc" },
    variantRules: { source: "", type: "", secondaryType: "", sort: "name-asc" },
    conditions: { source: "", type: "", secondaryType: "", sort: "name-asc" },
    optionalFeatures: { source: "", type: "", secondaryType: "", sort: "name-asc" },
    actions: { source: "", type: "", secondaryType: "", sort: "name-asc" },
    backgrounds: { source: "", type: "", secondaryType: "", sort: "name-asc" },
    items: { source: "", type: "", secondaryType: "", sort: "name-asc" },
    languages: { source: "", type: "", secondaryType: "", sort: "name-asc" },
    races: { source: "", type: "", secondaryType: "", sort: "name-asc" },
    skills: { source: "", type: "", secondaryType: "", sort: "name-asc" }
  });
  const [importFiles, setImportFiles] = useState<Record<CompendiumTab, { name: string; content: string } | null>>({
    spells: null,
    monsters: null,
    feats: null,
    classes: null,
    books: null,
    variantRules: null,
    conditions: null,
    optionalFeatures: null,
    actions: null,
    backgrounds: null,
    items: null,
    languages: null,
    races: null,
    skills: null
  });
  const [spellForm, setSpellForm] = useState<SpellFormState>(createSpellForm());
  const [monsterForm, setMonsterForm] = useState<MonsterFormState>(createMonsterForm());
  const [featForm, setFeatForm] = useState<FeatFormState>(createFeatForm());
  const [classForm, setClassForm] = useState<ClassFormState>(createClassForm());
  const [monsterTokenArchiveUploading, setMonsterTokenArchiveUploading] = useState(false);
  const activeCompendiumTab: CompendiumTab | null = tab === "users" ? null : tab;

  const {
    overview,
    isLoading: loading,
    refreshOverview
  } = useAdminOverviewQuery({
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
      classes: overview?.compendium.classes.length ?? 0,
      books: overview?.compendium.books.length ?? 0,
      variantRules: overview?.compendium.variantRules.length ?? 0,
      conditions: overview?.compendium.conditions.length ?? 0,
      optionalFeatures: overview?.compendium.optionalFeatures.length ?? 0,
      actions: overview?.compendium.actions.length ?? 0,
      backgrounds: overview?.compendium.backgrounds.length ?? 0,
      items: overview?.compendium.items.length ?? 0,
      languages: overview?.compendium.languages.length ?? 0,
      races: overview?.compendium.races.length ?? 0,
      skills: overview?.compendium.skills.length ?? 0
    }),
    [overview]
  );

  const users = useMemo(
    () => filterEntries(overview?.users ?? [], search.users, (user) => [user.name, user.email, user.isAdmin ? "admin" : "user"]),
    [overview?.users, search.users]
  );
  const spells = useMemo(
    () =>
      filterEntries(overview?.compendium.spells ?? [], search.spells, (entry) => [
        entry.name,
        entry.source,
        String(entry.level),
        entry.school
      ]),
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
  const books = useMemo(
    () =>
      filterEntries(overview?.compendium.books ?? [], search.books, (entry) => [
        entry.name,
        entry.source,
        entry.group,
        entry.author,
        entry.published
      ]),
    [overview?.compendium.books, search.books]
  );
  const variantRules = useMemo(
    () =>
      filterEntries(overview?.compendium.variantRules ?? [], search.variantRules, (entry) => [
        entry.name,
        entry.source,
        entry.category,
        ...entry.tags
      ]),
    [overview?.compendium.variantRules, search.variantRules]
  );
  const conditions = useMemo(
    () =>
      filterEntries(overview?.compendium.conditions ?? [], search.conditions, (entry) => [
        entry.name,
        entry.source,
        entry.category,
        ...entry.tags
      ]),
    [overview?.compendium.conditions, search.conditions]
  );
  const optionalFeatures = useMemo(
    () =>
      filterEntries(overview?.compendium.optionalFeatures ?? [], search.optionalFeatures, (entry) => [
        entry.name,
        entry.source,
        entry.category,
        ...entry.tags
      ]),
    [overview?.compendium.optionalFeatures, search.optionalFeatures]
  );
  const actions = useMemo(
    () =>
      filterEntries(overview?.compendium.actions ?? [], search.actions, (entry) => [
        entry.name,
        entry.source,
        entry.category,
        ...entry.tags
      ]),
    [overview?.compendium.actions, search.actions]
  );
  const backgrounds = useMemo(
    () =>
      filterEntries(overview?.compendium.backgrounds ?? [], search.backgrounds, (entry) => [
        entry.name,
        entry.source,
        entry.category,
        ...entry.tags
      ]),
    [overview?.compendium.backgrounds, search.backgrounds]
  );
  const items = useMemo(
    () =>
      filterEntries(overview?.compendium.items ?? [], search.items, (entry) => [entry.name, entry.source, entry.category, ...entry.tags]),
    [overview?.compendium.items, search.items]
  );
  const languages = useMemo(
    () =>
      filterEntries(overview?.compendium.languages ?? [], search.languages, (entry) => [
        entry.name,
        entry.source,
        entry.category,
        ...entry.tags
      ]),
    [overview?.compendium.languages, search.languages]
  );
  const races = useMemo(
    () =>
      filterEntries(overview?.compendium.races ?? [], search.races, (entry) => [entry.name, entry.source, entry.category, ...entry.tags]),
    [overview?.compendium.races, search.races]
  );
  const skills = useMemo(
    () =>
      filterEntries(overview?.compendium.skills ?? [], search.skills, (entry) => [entry.name, entry.source, entry.category, ...entry.tags]),
    [overview?.compendium.skills, search.skills]
  );
  const displayedSpells = useMemo(() => filterAndSortSpells(spells, listControls.spells), [listControls.spells, spells]);
  const displayedMonsters = useMemo(() => filterAndSortMonsters(monsters, listControls.monsters), [listControls.monsters, monsters]);
  const displayedFeats = useMemo(() => filterAndSortReferences(feats, listControls.feats), [feats, listControls.feats]);
  const displayedClasses = useMemo(() => filterAndSortClasses(classes, listControls.classes), [classes, listControls.classes]);
  const displayedBooks = useMemo(() => filterAndSortBooks(books, listControls.books), [books, listControls.books]);
  const displayedVariantRules = useMemo(
    () => filterAndSortReferences(variantRules, listControls.variantRules),
    [listControls.variantRules, variantRules]
  );
  const displayedConditions = useMemo(
    () => filterAndSortReferences(conditions, listControls.conditions),
    [conditions, listControls.conditions]
  );
  const displayedOptionalFeatures = useMemo(
    () => filterAndSortReferences(optionalFeatures, listControls.optionalFeatures),
    [listControls.optionalFeatures, optionalFeatures]
  );
  const displayedActions = useMemo(() => filterAndSortReferences(actions, listControls.actions), [actions, listControls.actions]);
  const displayedBackgrounds = useMemo(
    () => filterAndSortReferences(backgrounds, listControls.backgrounds),
    [backgrounds, listControls.backgrounds]
  );
  const displayedItems = useMemo(() => filterAndSortReferences(items, listControls.items), [items, listControls.items]);
  const displayedLanguages = useMemo(() => filterAndSortReferences(languages, listControls.languages), [languages, listControls.languages]);
  const displayedRaces = useMemo(() => filterAndSortReferences(races, listControls.races), [listControls.races, races]);
  const displayedSkills = useMemo(() => filterAndSortReferences(skills, listControls.skills), [listControls.skills, skills]);

  const selectedUser = resolveSelected(users, selectedIds.users);
  const selectedSpell = resolveSelected(displayedSpells, selectedIds.spells);
  const selectedMonster = resolveSelected(displayedMonsters, selectedIds.monsters);
  const selectedFeat = resolveSelected(displayedFeats, selectedIds.feats);
  const selectedClass = resolveSelected(displayedClasses, selectedIds.classes);
  const selectedBook = resolveSelectedByKey(displayedBooks, selectedIds.books, (entry) => entry.source);
  const selectedVariantRule = resolveSelected(displayedVariantRules, selectedIds.variantRules);
  const selectedCondition = resolveSelected(displayedConditions, selectedIds.conditions);
  const selectedOptionalFeature = resolveSelected(displayedOptionalFeatures, selectedIds.optionalFeatures);
  const selectedAction = resolveSelected(displayedActions, selectedIds.actions);
  const selectedBackground = resolveSelected(displayedBackgrounds, selectedIds.backgrounds);
  const selectedItem = resolveSelected(displayedItems, selectedIds.items);
  const selectedLanguage = resolveSelected(displayedLanguages, selectedIds.languages);
  const selectedRace = resolveSelected(displayedRaces, selectedIds.races);
  const selectedSkill = resolveSelected(displayedSkills, selectedIds.skills);

  const _spellPreview = useMemo(() => buildPreview(() => spellFormToEntry(spellForm)), [spellForm]);
  const _monsterPreview = useMemo(() => buildPreview(() => monsterFormToEntry(monsterForm)), [monsterForm]);
  const _featPreview = useMemo(() => buildPreview(() => featFormToEntry(featForm)), [featForm]);
  const _classPreview = useMemo(() => buildPreview(() => classFormToEntry(classForm)), [classForm]);
  const sourceBookNameById = useMemo(
    () => new Map((overview?.compendium.books ?? []).map((entry) => [entry.source, entry.name] as const)),
    [overview?.compendium.books]
  );

  const _importSummary = useMemo(() => {
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
      const isSubclassLookup = activeCompendiumTab === "classes" && isGeneratedSubclassLookupPayload(parsed);
      return {
        valid: true,
        message: isSpellLookup
          ? `${count} spell class lookups ready to apply to imported spells.`
          : isSubclassLookup
            ? `${count} subclasses ready to apply to imported classes.`
            : `${count} ${count === 1 ? singularLabel(activeCompendiumTab) : labelForTab(activeCompendiumTab)} ready to import.`
      };
    } catch (error) {
      return { valid: false, message: toErrorMessage(error) };
    }
  }, [activeCompendiumTab, importFiles]);
  const importExample = useMemo(() => (activeCompendiumTab ? getImportExample(activeCompendiumTab) : ""), [activeCompendiumTab]);
  const activeListControls = listControls[tab];
  const currentSourceOptions = useMemo(
    () =>
      getAdminTabSourceOptions(tab, {
        spells,
        monsters,
        feats,
        classes,
        books,
        variantRules,
        conditions,
        optionalFeatures,
        actions,
        backgrounds,
        items,
        languages,
        races,
        skills
      }),
    [actions, backgrounds, books, classes, conditions, feats, items, languages, monsters, optionalFeatures, races, skills, spells, tab, variantRules]
  );
  const currentTypeOptions = useMemo(
    () =>
      getAdminTabTypeOptions(tab, {
        spells,
        monsters,
        feats,
        classes,
        books,
        variantRules,
        conditions,
        optionalFeatures,
        actions,
        backgrounds,
        items,
        languages,
        races,
        skills
      }),
    [actions, backgrounds, books, classes, conditions, feats, items, languages, monsters, optionalFeatures, races, skills, spells, tab, variantRules]
  );
  const currentSecondaryTypeOptions = useMemo(
    () =>
      getAdminTabSecondaryTypeOptions(tab, {
        spells,
        monsters
      }),
    [monsters, spells, tab]
  );
  const currentSortOptions = getSortOptionsForTab(tab);

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
      if (kind === "books") {
        await onRefreshSourceBooks?.();
      }
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
      if (kind === "books") {
        await onRefreshSourceBooks?.();
      }
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
      if (kind === "books") {
        await onRefreshSourceBooks?.();
      }
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
      if (kind === "books") {
        await onRefreshSourceBooks?.();
      }
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
      const { url } = await uploadImageAsset(token, "tokens", file);
      setMonsterForm((current) => ({ ...current, imageUrl: url }));
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

  async function handleMonsterTokenArchiveUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      setMonsterTokenArchiveUploading(true);
      const result = await importMonsterTokenArchive(token, file);
      onStatus("info", formatMonsterTokenArchiveSummary(file.name, result));
      await refreshOverview();
    } catch (error) {
      onStatus("error", toErrorMessage(error));
    } finally {
      setMonsterTokenArchiveUploading(false);
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
                <button
                  type="button"
                  className={cx(styles.modeTab, mode === "list" && styles.modeTabActive)}
                  onClick={() => setMode("list")}
                >
                  <List size={15} />
                  <span>List</span>
                </button>
                <button type="button" className={cx(styles.modeTab, mode === "add" && styles.modeTabActive)} onClick={() => setMode("add")}>
                  <FilePlus2 size={15} />
                  <span>Add</span>
                </button>
                <button
                  type="button"
                  className={cx(styles.modeTab, mode === "import" && styles.modeTabActive)}
                  onClick={() => setMode("import")}
                >
                  <ArrowDownToLine size={15} />
                  <span>Import</span>
                </button>
              </div>
            ) : null}
          </div>

          <div className={styles.upperGrid}>
            {mode === "list" || tab === "users" ? (
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
                {tab !== "users" ? (
                  <div className={`grid gap-3 ${currentSecondaryTypeOptions.length > 0 ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
                    <label className="admin-search-field">
                      <span>Source</span>
                      <select
                        value={activeListControls.source}
                        onChange={(event) =>
                          setListControls((current) => ({
                            ...current,
                            [tab]: {
                              ...current[tab],
                              source: event.target.value
                            }
                          }))
                        }
                      >
                        <option value="">All sources</option>
                        {currentSourceOptions.map((option) => (
                          <option key={option.value} value={option.value} title={option.label}>
                            {option.value}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="admin-search-field">
                      <span>{getPrimaryFilterLabel(tab)}</span>
                      <select
                        value={activeListControls.type}
                        onChange={(event) =>
                          setListControls((current) => ({
                            ...current,
                            [tab]: {
                              ...current[tab],
                              type: event.target.value
                            }
                          }))
                        }
                      >
                        <option value="">{getPrimaryFilterEmptyLabel(tab)}</option>
                        {currentTypeOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    {currentSecondaryTypeOptions.length > 0 ? (
                      <label className="admin-search-field">
                        <span>{getSecondaryFilterLabel(tab)}</span>
                        <select
                          value={activeListControls.secondaryType}
                          onChange={(event) =>
                            setListControls((current) => ({
                              ...current,
                              [tab]: {
                                ...current[tab],
                                secondaryType: event.target.value
                              }
                            }))
                          }
                        >
                          <option value="">{getSecondaryFilterEmptyLabel(tab)}</option>
                          {currentSecondaryTypeOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <label className="admin-search-field">
                      <span>Sort</span>
                      <select
                        value={activeListControls.sort}
                        onChange={(event) =>
                          setListControls((current) => ({
                            ...current,
                            [tab]: {
                              ...current[tab],
                              sort: event.target.value as ListSort
                            }
                          }))
                        }
                      >
                        {currentSortOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : null}
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
                    displayedSpells.map((entry) => (
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
                          <span className="badge subtle" title={sourceBookNameById.get(entry.source) ?? entry.source}>
                            {entry.source}
                          </span>
                        </div>
                      </button>
                    ))}

                  {tab === "monsters" &&
                    displayedMonsters.map((entry) => (
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
                          <span className="badge subtle" title={sourceBookNameById.get(entry.source) ?? entry.source}>
                            {entry.source}
                          </span>
                        </div>
                      </button>
                    ))}

                  {tab === "feats" &&
                    displayedFeats.map((entry) => (
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
                          <span className="badge subtle" title={sourceBookNameById.get(entry.source) ?? entry.source}>
                            {entry.source}
                          </span>
                        </div>
                      </button>
                    ))}

                  {tab === "classes" &&
                    displayedClasses.map((entry) => (
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
                          <span className="badge subtle" title={sourceBookNameById.get(entry.source) ?? entry.source}>
                            {entry.source}
                          </span>
                        </div>
                      </button>
                    ))}

                  {tab === "books" && renderBookRows(displayedBooks, selectedBook, setSelectedIds)}
                  {tab === "variantRules" &&
                    renderReferenceRows(displayedVariantRules, selectedVariantRule, "variantRules", setSelectedIds, sourceBookNameById)}
                  {tab === "conditions" &&
                    renderReferenceRows(displayedConditions, selectedCondition, "conditions", setSelectedIds, sourceBookNameById)}
                  {tab === "optionalFeatures" &&
                    renderReferenceRows(
                      displayedOptionalFeatures,
                      selectedOptionalFeature,
                      "optionalFeatures",
                      setSelectedIds,
                      sourceBookNameById
                    )}
                  {tab === "actions" &&
                    renderReferenceRows(displayedActions, selectedAction, "actions", setSelectedIds, sourceBookNameById)}
                  {tab === "backgrounds" &&
                    renderReferenceRows(displayedBackgrounds, selectedBackground, "backgrounds", setSelectedIds, sourceBookNameById)}
                  {tab === "items" && renderReferenceRows(displayedItems, selectedItem, "items", setSelectedIds, sourceBookNameById)}
                  {tab === "languages" &&
                    renderReferenceRows(displayedLanguages, selectedLanguage, "languages", setSelectedIds, sourceBookNameById)}
                  {tab === "races" && renderReferenceRows(displayedRaces, selectedRace, "races", setSelectedIds, sourceBookNameById)}
                  {tab === "skills" && renderReferenceRows(displayedSkills, selectedSkill, "skills", setSelectedIds, sourceBookNameById)}

                  {countForTab(tab, {
                    users: users.length,
                    spells: spells.length,
                    monsters: monsters.length,
                    feats: feats.length,
                    classes: classes.length,
                    books: books.length,
                    variantRules: variantRules.length,
                    conditions: conditions.length,
                    optionalFeatures: optionalFeatures.length,
                    actions: actions.length,
                    backgrounds: backgrounds.length,
                    items: items.length,
                    languages: languages.length,
                    races: races.length,
                    skills: skills.length
                  }) === 0 && <p className="empty-state">No entries found.</p>}
                </div>
              </section>
            ) : (
              <section className="admin-pane admin-form-pane">
                <div className="panel-head">
                  <div>
                    <p className="panel-label">{mode === "add" ? "Create" : "Import"}</p>
                    <h3>{mode === "add" ? `Add ${singularLabel(tab)}` : `Import ${labelForTab(tab)}`}</h3>
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

                {mode === "add" ? (
                  <>
                    {tab === "spells" && (
                      <form className="admin-form-grid" onSubmit={handleSpellSubmit}>
                        <AdminField label="Name">
                          <input value={spellForm.name} onChange={(event) => setSpellForm({ ...spellForm, name: event.target.value })} />
                        </AdminField>
                        <AdminField label="Source">
                          <input
                            value={spellForm.source}
                            onChange={(event) => setSpellForm({ ...spellForm, source: event.target.value })}
                          />
                        </AdminField>
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
                          <select
                            value={spellForm.school}
                            onChange={(event) => setSpellForm({ ...spellForm, school: event.target.value as SpellEntry["school"] })}
                          >
                            {[
                              "Abjuration",
                              "Conjuration",
                              "Divination",
                              "Enchantment",
                              "Evocation",
                              "Illusion",
                              "Necromancy",
                              "Transmutation"
                            ].map((school) => (
                              <option key={school} value={school}>
                                {school}
                              </option>
                            ))}
                          </select>
                        </AdminField>
                        <AdminField label="Casting time unit">
                          <select
                            value={spellForm.castingTimeUnit}
                            onChange={(event) =>
                              setSpellForm({ ...spellForm, castingTimeUnit: event.target.value as SpellEntry["castingTimeUnit"] })
                            }
                          >
                            {["action", "bonus action", "minute", "hour"].map((unit) => (
                              <option key={unit} value={unit}>
                                {unit}
                              </option>
                            ))}
                          </select>
                        </AdminField>
                        <AdminField label="Casting time value">
                          <input
                            value={spellForm.castingTimeValue}
                            onChange={(event) => setSpellForm({ ...spellForm, castingTimeValue: event.target.value })}
                          />
                        </AdminField>
                        <AdminField label="Range type">
                          <select
                            value={spellForm.rangeType}
                            onChange={(event) => setSpellForm({ ...spellForm, rangeType: event.target.value as SpellEntry["rangeType"] })}
                          >
                            {["feet", "self", "self emanation", "touch"].map((unit) => (
                              <option key={unit} value={unit}>
                                {unit}
                              </option>
                            ))}
                          </select>
                        </AdminField>
                        <AdminField label="Range value">
                          <input
                            value={spellForm.rangeValue}
                            onChange={(event) => setSpellForm({ ...spellForm, rangeValue: event.target.value })}
                          />
                        </AdminField>
                        <AdminField label="Duration unit">
                          <select
                            value={spellForm.durationUnit}
                            onChange={(event) =>
                              setSpellForm({ ...spellForm, durationUnit: event.target.value as SpellEntry["durationUnit"] })
                            }
                          >
                            {["instant", "minute", "hour"].map((unit) => (
                              <option key={unit} value={unit}>
                                {unit}
                              </option>
                            ))}
                          </select>
                        </AdminField>
                        <AdminField label="Duration value">
                          <input
                            value={spellForm.durationValue}
                            onChange={(event) => setSpellForm({ ...spellForm, durationValue: event.target.value })}
                          />
                        </AdminField>
                        <AdminField label="Damage notation">
                          <input
                            value={spellForm.damageNotation}
                            onChange={(event) => setSpellForm({ ...spellForm, damageNotation: event.target.value })}
                          />
                        </AdminField>
                        <AdminField label="Damage ability">
                          <select
                            value={spellForm.damageAbility}
                            onChange={(event) =>
                              setSpellForm({ ...spellForm, damageAbility: event.target.value as SpellFormState["damageAbility"] })
                            }
                          >
                            <option value="">None</option>
                            {["str", "dex", "con", "int", "wis", "cha"].map((ability) => (
                              <option key={ability} value={ability}>
                                {ability.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </AdminField>
                        <AdminField label="Classes" wide>
                          <input
                            value={spellForm.classesText}
                            onChange={(event) => setSpellForm({ ...spellForm, classesText: event.target.value })}
                            placeholder="Wizard, Sorcerer"
                          />
                        </AdminField>
                        <AdminField label="Short description" wide>
                          <textarea
                            value={spellForm.description}
                            onChange={(event) => setSpellForm({ ...spellForm, description: event.target.value })}
                          />
                        </AdminField>
                        <AdminField label="Full description" wide>
                          <textarea
                            value={spellForm.fullDescription}
                            onChange={(event) => setSpellForm({ ...spellForm, fullDescription: event.target.value })}
                          />
                        </AdminField>
                        <fieldset className="admin-checks">
                          <legend>Components and flags</legend>
                          <label>
                            <input
                              type="checkbox"
                              checked={spellForm.verbal}
                              onChange={(event) => setSpellForm({ ...spellForm, verbal: event.target.checked })}
                            />{" "}
                            Verbal
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={spellForm.somatic}
                              onChange={(event) => setSpellForm({ ...spellForm, somatic: event.target.checked })}
                            />{" "}
                            Somatic
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={spellForm.material}
                              onChange={(event) => setSpellForm({ ...spellForm, material: event.target.checked })}
                            />{" "}
                            Material
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={spellForm.materialConsumed}
                              onChange={(event) => setSpellForm({ ...spellForm, materialConsumed: event.target.checked })}
                            />{" "}
                            Material consumed
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={spellForm.concentration}
                              onChange={(event) => setSpellForm({ ...spellForm, concentration: event.target.checked })}
                            />{" "}
                            Concentration
                          </label>
                        </fieldset>
                        <AdminField label="Material text">
                          <input
                            value={spellForm.materialText}
                            onChange={(event) => setSpellForm({ ...spellForm, materialText: event.target.value })}
                          />
                        </AdminField>
                        <AdminField label="Material value">
                          <input
                            value={spellForm.materialValue}
                            onChange={(event) => setSpellForm({ ...spellForm, materialValue: event.target.value })}
                          />
                        </AdminField>
                        <button className="accent-button" type="submit">
                          Add spell
                        </button>
                      </form>
                    )}
                    {tab === "monsters" && (
                      <form className="admin-form-grid admin-form-grid-wide" onSubmit={handleMonsterSubmit}>
                        <AdminField label="Name">
                          <input
                            value={monsterForm.name}
                            onChange={(event) => setMonsterForm({ ...monsterForm, name: event.target.value })}
                          />
                        </AdminField>
                        <Field label="Source">
                          <input
                            value={monsterForm.source}
                            onChange={(event) => setMonsterForm({ ...monsterForm, source: event.target.value })}
                          />
                        </Field>
                        <Field label="Challenge rating">
                          <input
                            value={monsterForm.challengeRating}
                            onChange={(event) => setMonsterForm({ ...monsterForm, challengeRating: event.target.value })}
                          />
                        </Field>
                        <Field label="Armor class">
                          <input
                            value={monsterForm.armorClass}
                            onChange={(event) => setMonsterForm({ ...monsterForm, armorClass: event.target.value })}
                          />
                        </Field>
                        <Field label="Hit points">
                          <input
                            value={monsterForm.hitPoints}
                            onChange={(event) => setMonsterForm({ ...monsterForm, hitPoints: event.target.value })}
                          />
                        </Field>
                        <Field label="Initiative">
                          <input
                            value={monsterForm.initiative}
                            onChange={(event) => setMonsterForm({ ...monsterForm, initiative: event.target.value })}
                          />
                        </Field>
                        <Field label="Experience">
                          <input value={monsterForm.xp} onChange={(event) => setMonsterForm({ ...monsterForm, xp: event.target.value })} />
                        </Field>
                        <Field label="Proficiency bonus">
                          <input
                            value={monsterForm.proficiencyBonus}
                            onChange={(event) => setMonsterForm({ ...monsterForm, proficiencyBonus: event.target.value })}
                          />
                        </Field>
                        <Field label="Passive perception">
                          <input
                            value={monsterForm.passivePerception}
                            onChange={(event) => setMonsterForm({ ...monsterForm, passivePerception: event.target.value })}
                          />
                        </Field>
                        <Field label="Walk speed">
                          <input
                            value={monsterForm.walk}
                            onChange={(event) => setMonsterForm({ ...monsterForm, walk: event.target.value })}
                          />
                        </Field>
                        <Field label="Fly speed">
                          <input
                            value={monsterForm.fly}
                            onChange={(event) => setMonsterForm({ ...monsterForm, fly: event.target.value })}
                          />
                        </Field>
                        <Field label="Burrow speed">
                          <input
                            value={monsterForm.burrow}
                            onChange={(event) => setMonsterForm({ ...monsterForm, burrow: event.target.value })}
                          />
                        </Field>
                        <Field label="Swim speed">
                          <input
                            value={monsterForm.swim}
                            onChange={(event) => setMonsterForm({ ...monsterForm, swim: event.target.value })}
                          />
                        </Field>
                        <Field label="Climb speed">
                          <input
                            value={monsterForm.climb}
                            onChange={(event) => setMonsterForm({ ...monsterForm, climb: event.target.value })}
                          />
                        </Field>
                        <Field label="Strength">
                          <input
                            value={monsterForm.str}
                            onChange={(event) => setMonsterForm({ ...monsterForm, str: event.target.value })}
                          />
                        </Field>
                        <Field label="Dexterity">
                          <input
                            value={monsterForm.dex}
                            onChange={(event) => setMonsterForm({ ...monsterForm, dex: event.target.value })}
                          />
                        </Field>
                        <Field label="Constitution">
                          <input
                            value={monsterForm.con}
                            onChange={(event) => setMonsterForm({ ...monsterForm, con: event.target.value })}
                          />
                        </Field>
                        <Field label="Intelligence">
                          <input
                            value={monsterForm.int}
                            onChange={(event) => setMonsterForm({ ...monsterForm, int: event.target.value })}
                          />
                        </Field>
                        <Field label="Wisdom">
                          <input
                            value={monsterForm.wis}
                            onChange={(event) => setMonsterForm({ ...monsterForm, wis: event.target.value })}
                          />
                        </Field>
                        <Field label="Charisma">
                          <input
                            value={monsterForm.cha}
                            onChange={(event) => setMonsterForm({ ...monsterForm, cha: event.target.value })}
                          />
                        </Field>
                        <Field label="Skills" wide>
                          <input
                            value={monsterForm.skillsText}
                            onChange={(event) => setMonsterForm({ ...monsterForm, skillsText: event.target.value })}
                            placeholder="Perception:13, Stealth:6"
                          />
                        </Field>
                        <Field label="Senses" wide>
                          <input
                            value={monsterForm.sensesText}
                            onChange={(event) => setMonsterForm({ ...monsterForm, sensesText: event.target.value })}
                            placeholder="Darkvision:120, Blindsight:60"
                          />
                        </Field>
                        <Field label="Languages" wide>
                          <input
                            value={monsterForm.languagesText}
                            onChange={(event) => setMonsterForm({ ...monsterForm, languagesText: event.target.value })}
                            placeholder="Common, Draconic"
                          />
                        </Field>
                        <Field label="Gear" wide>
                          <input
                            value={monsterForm.gearText}
                            onChange={(event) => setMonsterForm({ ...monsterForm, gearText: event.target.value })}
                          />
                        </Field>
                        <Field label="Resistances" wide>
                          <input
                            value={monsterForm.resistancesText}
                            onChange={(event) => setMonsterForm({ ...monsterForm, resistancesText: event.target.value })}
                          />
                        </Field>
                        <Field label="Vulnerabilities" wide>
                          <input
                            value={monsterForm.vulnerabilitiesText}
                            onChange={(event) => setMonsterForm({ ...monsterForm, vulnerabilitiesText: event.target.value })}
                          />
                        </Field>
                        <Field label="Immunities" wide>
                          <input
                            value={monsterForm.immunitiesText}
                            onChange={(event) => setMonsterForm({ ...monsterForm, immunitiesText: event.target.value })}
                          />
                        </Field>
                        <Field label="Traits" wide>
                          <textarea
                            value={monsterForm.traitsText}
                            onChange={(event) => setMonsterForm({ ...monsterForm, traitsText: event.target.value })}
                            placeholder="One trait per line"
                          />
                        </Field>
                        <Field label="Spells" wide>
                          <input
                            value={monsterForm.spellsText}
                            onChange={(event) => setMonsterForm({ ...monsterForm, spellsText: event.target.value })}
                          />
                        </Field>
                        <Field label="Actions JSON" wide>
                          <textarea
                            value={monsterForm.actionsJson}
                            onChange={(event) => setMonsterForm({ ...monsterForm, actionsJson: event.target.value })}
                            placeholder={JSON.stringify([monsterActionTemplate], null, 2)}
                          />
                        </Field>
                        <Field label="Bonus actions JSON" wide>
                          <textarea
                            value={monsterForm.bonusActionsJson}
                            onChange={(event) => setMonsterForm({ ...monsterForm, bonusActionsJson: event.target.value })}
                          />
                        </Field>
                        <Field label="Reactions JSON" wide>
                          <textarea
                            value={monsterForm.reactionsJson}
                            onChange={(event) => setMonsterForm({ ...monsterForm, reactionsJson: event.target.value })}
                          />
                        </Field>
                        <Field label="Legendary actions JSON" wide>
                          <textarea
                            value={monsterForm.legendaryActionsJson}
                            onChange={(event) => setMonsterForm({ ...monsterForm, legendaryActionsJson: event.target.value })}
                          />
                        </Field>
                        <Field label="Legendary action uses">
                          <input
                            value={monsterForm.legendaryActionsUse}
                            onChange={(event) => setMonsterForm({ ...monsterForm, legendaryActionsUse: event.target.value })}
                          />
                        </Field>
                        <Field label="Lair actions JSON" wide>
                          <textarea
                            value={monsterForm.lairActionsJson}
                            onChange={(event) => setMonsterForm({ ...monsterForm, lairActionsJson: event.target.value })}
                          />
                        </Field>
                        <Field label="Regional effects JSON" wide>
                          <textarea
                            value={monsterForm.regionalEffectsJson}
                            onChange={(event) => setMonsterForm({ ...monsterForm, regionalEffectsJson: event.target.value })}
                          />
                        </Field>
                        <Field label="Habitat">
                          <input
                            value={monsterForm.habitat}
                            onChange={(event) => setMonsterForm({ ...monsterForm, habitat: event.target.value })}
                          />
                        </Field>
                        <Field label="Treasure">
                          <input
                            value={monsterForm.treasure}
                            onChange={(event) => setMonsterForm({ ...monsterForm, treasure: event.target.value })}
                          />
                        </Field>
                        <Field label="Image URL">
                          <input
                            value={monsterForm.imageUrl}
                            onChange={(event) => setMonsterForm({ ...monsterForm, imageUrl: event.target.value })}
                          />
                        </Field>
                        <Field label="Upload image">
                          <div className="admin-image-controls">
                            <input type="file" accept="image/*" onChange={(event) => void handleMonsterImageUpload(event)} />
                            <button
                              type="button"
                              onClick={() => setMonsterForm({ ...monsterForm, imageUrl: "" })}
                              disabled={!monsterForm.imageUrl}
                            >
                              Clear image
                            </button>
                          </div>
                        </Field>
                        <Field label="Color" wide>
                          <div className="color-field">
                            <input
                              type="color"
                              value={monsterForm.color}
                              onChange={(event) => setMonsterForm({ ...monsterForm, color: event.target.value })}
                            />
                            <span>{monsterForm.color}</span>
                          </div>
                        </Field>
                        <button className="accent-button" type="submit">
                          Add monster
                        </button>
                      </form>
                    )}
                    {tab === "feats" && (
                      <form className="admin-form-grid" onSubmit={handleFeatSubmit}>
                        <AdminField label="Name">
                          <input value={featForm.name} onChange={(event) => setFeatForm({ ...featForm, name: event.target.value })} />
                        </AdminField>
                        <Field label="Source">
                          <input value={featForm.source} onChange={(event) => setFeatForm({ ...featForm, source: event.target.value })} />
                        </Field>
                        <Field label="Category">
                          <input
                            value={featForm.category}
                            onChange={(event) => setFeatForm({ ...featForm, category: event.target.value })}
                          />
                        </Field>
                        <Field label="Ability score increase">
                          <input
                            value={featForm.abilityScoreIncrease}
                            onChange={(event) => setFeatForm({ ...featForm, abilityScoreIncrease: event.target.value })}
                          />
                        </Field>
                        <Field label="Prerequisites" wide>
                          <input
                            value={featForm.prerequisites}
                            onChange={(event) => setFeatForm({ ...featForm, prerequisites: event.target.value })}
                          />
                        </Field>
                        <Field label="Description" wide>
                          <textarea
                            value={featForm.description}
                            onChange={(event) => setFeatForm({ ...featForm, description: event.target.value })}
                          />
                        </Field>
                        <button className="accent-button" type="submit">
                          Add feat
                        </button>
                      </form>
                    )}
                    {tab === "classes" && (
                      <form className="admin-form-grid" onSubmit={handleClassSubmit}>
                        <AdminField label="Name">
                          <input value={classForm.name} onChange={(event) => setClassForm({ ...classForm, name: event.target.value })} />
                        </AdminField>
                        <Field label="Source">
                          <input
                            value={classForm.source}
                            onChange={(event) => setClassForm({ ...classForm, source: event.target.value })}
                          />
                        </Field>
                        <Field label="Description" wide>
                          <textarea
                            value={classForm.description}
                            onChange={(event) => setClassForm({ ...classForm, description: event.target.value })}
                          />
                        </Field>
                        <Field label="Features JSON" wide>
                          <textarea
                            value={classForm.featuresJson}
                            onChange={(event) => setClassForm({ ...classForm, featuresJson: event.target.value })}
                          />
                        </Field>
                        <Field label="Tables JSON" wide>
                          <textarea
                            value={classForm.tablesJson}
                            onChange={(event) => setClassForm({ ...classForm, tablesJson: event.target.value })}
                          />
                        </Field>
                        <button className="accent-button" type="submit">
                          Add class
                        </button>
                      </form>
                    )}
                    {["variantRules", "conditions", "optionalFeatures", "actions", "backgrounds", "items", "languages", "races", "skills"].includes(tab) && (
                      <PreviewPlaceholder
                        title={`${singularLabel(tab)} add`}
                        message="Use Import mode for these reference libraries. The backend now supports direct imports for the matching 5etools JSON files."
                      />
                    )}
                  </>
                ) : (
                  <>
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
                          <strong>
                            {activeCompendiumTab ? (importFiles[activeCompendiumTab]?.name ?? "No file selected") : "No file selected"}
                          </strong>
                          <small>
                            {activeCompendiumTab && importFiles[activeCompendiumTab]?.content
                              ? `${importFiles[activeCompendiumTab]?.content.length.toLocaleString()} characters loaded`
                              : `Upload one ${singularLabel(tab).toLowerCase()} object or an array of ${labelForTab(tab).toLowerCase()}.`}
                          </small>
                          {tab === "spells" ? (
                            <small>
                              Accepted spell files: raw 5etools `spell` JSON or `gendata-spell-source-lookup.json` to enrich imported spells
                              with class references.
                            </small>
                          ) : tab === "classes" ? (
                            <small>
                              Accepted class files: raw 5etools `class` JSON, including `subclass` and `subclassFeature`, or
                              `gendata-subclass-lookup.json` to enrich imported classes with subclass stubs.
                            </small>
                          ) : tab === "books" ? (
                            <small>
                              Accepted book files: 5etools `books.json` with `book` entries. Only id, name, group, published, and author are
                              imported.
                            </small>
                          ) : tab === "variantRules" ? (
                            <small>Accepted variant rule files: 5etools `variantrules.json` with `variantrule` entries.</small>
                          ) : tab === "conditions" ? (
                            <small>Accepted condition files: 5etools JSON with `condition` entries.</small>
                          ) : tab === "optionalFeatures" ? (
                            <small>Accepted optional feature files: 5etools `optionalfeatures.json` with `optionalfeature` entries.</small>
                          ) : tab === "items" ? (
                            <small>Accepted item files: 5etools `items.json` and `items-base.json`.</small>
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
                    {tab === "monsters" && (
                      <label className="admin-search-field">
                        <span>Token Image ZIP</span>
                        <div className="admin-import-upload">
                          <input
                            type="file"
                            accept=".zip,application/zip,application/x-zip-compressed"
                            disabled={monsterTokenArchiveUploading}
                            onChange={(event) => void handleMonsterTokenArchiveUpload(event)}
                          />
                          <div className="admin-import-file-meta">
                            <strong>{monsterTokenArchiveUploading ? "Uploading archive…" : "Upload a monster token archive"}</strong>
                            <small>Archive image names are matched against monster names. Example: `Goblin.png` updates Goblin.</small>
                            <small>Uploaded images are converted to optimized WebP, and token images are downscaled when needed.</small>
                          </div>
                        </div>
                      </label>
                    )}
                    <label className="admin-search-field">
                      <span>Example JSON</span>
                      <textarea className="admin-json admin-json-example" value={importExample} readOnly />
                    </label>
                  </>
                )}
              </section>
            )}

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
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => void removeCompendiumEntry("spells", selectedSpell.id)}
                      >
                        Delete
                      </button>
                    ) : null}
                    {tab === "monsters" && selectedMonster ? (
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => void removeCompendiumEntry("monsters", selectedMonster.id)}
                      >
                        Delete
                      </button>
                    ) : null}
                    {tab === "feats" && selectedFeat ? (
                      <button type="button" className="danger-button" onClick={() => void removeCompendiumEntry("feats", selectedFeat.id)}>
                        Delete
                      </button>
                    ) : null}
                    {tab === "classes" && selectedClass ? (
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => void removeCompendiumEntry("classes", selectedClass.id)}
                      >
                        Delete
                      </button>
                    ) : null}
                    {tab === "books" && selectedBook ? (
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => void removeCompendiumEntry("books", selectedBook.source)}
                      >
                        Delete
                      </button>
                    ) : null}
                    {tab === "variantRules" && selectedVariantRule ? (
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => void removeCompendiumEntry("variantRules", selectedVariantRule.id)}
                      >
                        Delete
                      </button>
                    ) : null}
                    {tab === "conditions" && selectedCondition ? (
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => void removeCompendiumEntry("conditions", selectedCondition.id)}
                      >
                        Delete
                      </button>
                    ) : null}
                    {tab === "optionalFeatures" && selectedOptionalFeature ? (
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => void removeCompendiumEntry("optionalFeatures", selectedOptionalFeature.id)}
                      >
                        Delete
                      </button>
                    ) : null}
                    {tab === "actions" && selectedAction ? (
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => void removeCompendiumEntry("actions", selectedAction.id)}
                      >
                        Delete
                      </button>
                    ) : null}
                    {tab === "backgrounds" && selectedBackground ? (
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => void removeCompendiumEntry("backgrounds", selectedBackground.id)}
                      >
                        Delete
                      </button>
                    ) : null}
                    {tab === "items" && selectedItem ? (
                      <button type="button" className="danger-button" onClick={() => void removeCompendiumEntry("items", selectedItem.id)}>
                        Delete
                      </button>
                    ) : null}
                    {tab === "languages" && selectedLanguage ? (
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => void removeCompendiumEntry("languages", selectedLanguage.id)}
                      >
                        Delete
                      </button>
                    ) : null}
                    {tab === "races" && selectedRace ? (
                      <button type="button" className="danger-button" onClick={() => void removeCompendiumEntry("races", selectedRace.id)}>
                        Delete
                      </button>
                    ) : null}
                    {tab === "skills" && selectedSkill ? (
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => void removeCompendiumEntry("skills", selectedSkill.id)}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {tab === "users" &&
                (selectedUser ? (
                  <UserPreviewCard user={selectedUser} />
                ) : (
                  <PreviewPlaceholder title="Users" message="Select a user to inspect details and manage access." />
                ))}
              {tab === "spells" &&
                (selectedSpell ? (
                  <SpellPreviewCard
                    spell={selectedSpell}
                    featEntries={overview?.compendium.feats ?? []}
                    classEntries={overview?.compendium.classes ?? []}
                    variantRuleEntries={overview?.compendium.variantRules ?? []}
                    conditionEntries={overview?.compendium.conditions ?? []}
                    actionEntries={overview?.compendium.actions ?? []}
                    sourceTitle={sourceBookNameById.get(selectedSpell.source)}
                  />
                ) : (
                  <PreviewPlaceholder title="Spells" message="Select a spell to preview it here." />
                ))}
              {tab === "monsters" &&
                (selectedMonster ? (
                  <MonsterPreviewCard
                    monster={selectedMonster}
                    spellEntries={overview?.compendium.spells ?? []}
                    featEntries={overview?.compendium.feats ?? []}
                    classEntries={overview?.compendium.classes ?? []}
                    variantRuleEntries={overview?.compendium.variantRules ?? []}
                    conditionEntries={overview?.compendium.conditions ?? []}
                    actionEntries={overview?.compendium.actions ?? []}
                    sourceTitle={sourceBookNameById.get(selectedMonster.source)}
                  />
                ) : (
                  <PreviewPlaceholder title="Monsters" message="Select a monster to preview it here." />
                ))}
              {tab === "feats" &&
                (selectedFeat ? (
                  <FeatPreviewCard
                    feat={selectedFeat}
                    spellEntries={overview?.compendium.spells ?? []}
                    classEntries={overview?.compendium.classes ?? []}
                    variantRuleEntries={overview?.compendium.variantRules ?? []}
                    conditionEntries={overview?.compendium.conditions ?? []}
                    actionEntries={overview?.compendium.actions ?? []}
                    sourceTitle={sourceBookNameById.get(selectedFeat.source)}
                  />
                ) : (
                  <PreviewPlaceholder title="Feats" message="Select a feat to preview it here." />
                ))}
              {tab === "classes" &&
                (selectedClass ? (
                  <ClassPreviewCard
                    entry={selectedClass}
                    spellEntries={overview?.compendium.spells ?? []}
                    featEntries={overview?.compendium.feats ?? []}
                    variantRuleEntries={overview?.compendium.variantRules ?? []}
                    conditionEntries={overview?.compendium.conditions ?? []}
                    actionEntries={overview?.compendium.actions ?? []}
                    sourceTitle={sourceBookNameById.get(selectedClass.source)}
                  />
                ) : (
                  <PreviewPlaceholder title="Classes" message="Select a class to preview it here." />
                ))}
              {tab === "books" &&
                (selectedBook ? (
                  <BookPreviewCard entry={selectedBook} />
                ) : (
                  <PreviewPlaceholder title="Books" message="Select a book to preview it here." />
                ))}
              {tab === "variantRules" &&
                (selectedVariantRule ? (
                  <ReferencePreviewCard
                    title="Variant Rule"
                    eyebrow="Variant Rule"
                    entry={selectedVariantRule}
                    spellEntries={overview?.compendium.spells ?? []}
                    featEntries={overview?.compendium.feats ?? []}
                    classEntries={overview?.compendium.classes ?? []}
                    variantRuleEntries={overview?.compendium.variantRules ?? []}
                    conditionEntries={overview?.compendium.conditions ?? []}
                    actionEntries={overview?.compendium.actions ?? []}
                    sourceTitle={sourceBookNameById.get(selectedVariantRule.source)}
                  />
                ) : (
                  <PreviewPlaceholder title="Variant Rules" message="Select a variant rule to preview it here." />
                ))}
              {tab === "conditions" &&
                (selectedCondition ? (
                  <ReferencePreviewCard
                    title="Condition"
                    eyebrow="Condition"
                    entry={selectedCondition}
                    spellEntries={overview?.compendium.spells ?? []}
                    featEntries={overview?.compendium.feats ?? []}
                    classEntries={overview?.compendium.classes ?? []}
                    variantRuleEntries={overview?.compendium.variantRules ?? []}
                    conditionEntries={overview?.compendium.conditions ?? []}
                    actionEntries={overview?.compendium.actions ?? []}
                    sourceTitle={sourceBookNameById.get(selectedCondition.source)}
                  />
                ) : (
                  <PreviewPlaceholder title="Conditions" message="Select a condition to preview it here." />
                ))}
              {tab === "optionalFeatures" &&
                (selectedOptionalFeature ? (
                  <ReferencePreviewCard
                    title="Optional Feature"
                    eyebrow="Optional Feature"
                    entry={selectedOptionalFeature}
                    spellEntries={overview?.compendium.spells ?? []}
                    featEntries={overview?.compendium.feats ?? []}
                    classEntries={overview?.compendium.classes ?? []}
                    variantRuleEntries={overview?.compendium.variantRules ?? []}
                    conditionEntries={overview?.compendium.conditions ?? []}
                    actionEntries={overview?.compendium.actions ?? []}
                    sourceTitle={sourceBookNameById.get(selectedOptionalFeature.source)}
                  />
                ) : (
                  <PreviewPlaceholder title="Optional Features" message="Select an optional feature to preview it here." />
                ))}
              {tab === "actions" &&
                (selectedAction ? (
                  <ReferencePreviewCard
                    title="Action"
                    eyebrow="Action"
                    entry={selectedAction}
                    spellEntries={overview?.compendium.spells ?? []}
                    featEntries={overview?.compendium.feats ?? []}
                    classEntries={overview?.compendium.classes ?? []}
                    variantRuleEntries={overview?.compendium.variantRules ?? []}
                    conditionEntries={overview?.compendium.conditions ?? []}
                    actionEntries={overview?.compendium.actions ?? []}
                    sourceTitle={sourceBookNameById.get(selectedAction.source)}
                  />
                ) : (
                  <PreviewPlaceholder title="Actions" message="Select an action to preview it here." />
                ))}
              {tab === "backgrounds" &&
                (selectedBackground ? (
                  <ReferencePreviewCard
                    title="Background"
                    eyebrow="Background"
                    entry={selectedBackground}
                    spellEntries={overview?.compendium.spells ?? []}
                    featEntries={overview?.compendium.feats ?? []}
                    classEntries={overview?.compendium.classes ?? []}
                    variantRuleEntries={overview?.compendium.variantRules ?? []}
                    conditionEntries={overview?.compendium.conditions ?? []}
                    actionEntries={overview?.compendium.actions ?? []}
                    sourceTitle={sourceBookNameById.get(selectedBackground.source)}
                  />
                ) : (
                  <PreviewPlaceholder title="Backgrounds" message="Select a background to preview it here." />
                ))}
              {tab === "items" &&
                (selectedItem ? (
                  <ReferencePreviewCard
                    title="Item"
                    eyebrow="Item"
                    entry={selectedItem}
                    spellEntries={overview?.compendium.spells ?? []}
                    featEntries={overview?.compendium.feats ?? []}
                    classEntries={overview?.compendium.classes ?? []}
                    variantRuleEntries={overview?.compendium.variantRules ?? []}
                    conditionEntries={overview?.compendium.conditions ?? []}
                    actionEntries={overview?.compendium.actions ?? []}
                    sourceTitle={sourceBookNameById.get(selectedItem.source)}
                  />
                ) : (
                  <PreviewPlaceholder title="Items" message="Select an item to preview it here." />
                ))}
              {tab === "languages" &&
                (selectedLanguage ? (
                  <ReferencePreviewCard
                    title="Language"
                    eyebrow="Language"
                    entry={selectedLanguage}
                    spellEntries={overview?.compendium.spells ?? []}
                    featEntries={overview?.compendium.feats ?? []}
                    classEntries={overview?.compendium.classes ?? []}
                    variantRuleEntries={overview?.compendium.variantRules ?? []}
                    conditionEntries={overview?.compendium.conditions ?? []}
                    actionEntries={overview?.compendium.actions ?? []}
                    sourceTitle={sourceBookNameById.get(selectedLanguage.source)}
                  />
                ) : (
                  <PreviewPlaceholder title="Languages" message="Select a language to preview it here." />
                ))}
              {tab === "races" &&
                (selectedRace ? (
                  <ReferencePreviewCard
                    title="Race"
                    eyebrow="Race"
                    entry={selectedRace}
                    spellEntries={overview?.compendium.spells ?? []}
                    featEntries={overview?.compendium.feats ?? []}
                    classEntries={overview?.compendium.classes ?? []}
                    variantRuleEntries={overview?.compendium.variantRules ?? []}
                    conditionEntries={overview?.compendium.conditions ?? []}
                    actionEntries={overview?.compendium.actions ?? []}
                    sourceTitle={sourceBookNameById.get(selectedRace.source)}
                  />
                ) : (
                  <PreviewPlaceholder title="Races" message="Select a race to preview it here." />
                ))}
              {tab === "skills" &&
                (selectedSkill ? (
                  <ReferencePreviewCard
                    title="Skill"
                    eyebrow="Skill"
                    entry={selectedSkill}
                    spellEntries={overview?.compendium.spells ?? []}
                    featEntries={overview?.compendium.feats ?? []}
                    classEntries={overview?.compendium.classes ?? []}
                    variantRuleEntries={overview?.compendium.variantRules ?? []}
                    conditionEntries={overview?.compendium.conditions ?? []}
                    actionEntries={overview?.compendium.actions ?? []}
                    sourceTitle={sourceBookNameById.get(selectedSkill.source)}
                  />
                ) : (
                  <PreviewPlaceholder title="Skills" message="Select a skill to preview it here." />
                ))}
            </section>
          </div>
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

    if (kind === "classes" && isGeneratedSubclassLookupPayload(record)) {
      return countGeneratedSubclassLookupEntries(record);
    }

    if (kind === "books" && Array.isArray(record.book)) {
      return record.book.length;
    }

    if (kind === "variantRules" && Array.isArray(record.variantrule)) {
      return record.variantrule.length;
    }

    if (kind === "conditions" && Array.isArray(record.condition)) {
      return record.condition.length;
    }

    if (kind === "optionalFeatures" && Array.isArray(record.optionalfeature)) {
      return record.optionalfeature.length;
    }

    if (kind === "actions" && Array.isArray(record.action)) {
      return record.action.length;
    }

    if (kind === "backgrounds" && Array.isArray(record.background)) {
      return record.background.length;
    }

    if (kind === "items") {
      return [...readObjectArray(record.item), ...readObjectArray(record.baseitem)].length || 1;
    }

    if (kind === "languages" && Array.isArray(record.language)) {
      return record.language.length;
    }

    if (kind === "races") {
      return [...readObjectArray(record.race), ...readObjectArray(record.subrace)].length || 1;
    }

    if (kind === "skills" && Array.isArray(record.skill)) {
      return record.skill.length;
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

function isGeneratedSubclassLookupPayload(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).some((classBucket) => {
    if (typeof classBucket !== "object" || classBucket === null || Array.isArray(classBucket)) {
      return false;
    }

    return Object.values(classBucket).some((subclassBucket) => {
      if (typeof subclassBucket !== "object" || subclassBucket === null || Array.isArray(subclassBucket)) {
        return false;
      }

      return Object.values(subclassBucket).some((entries) => typeof entries === "object" && entries !== null && !Array.isArray(entries));
    });
  });
}

function countGeneratedSubclassLookupEntries(value: Record<string, unknown>) {
  let count = 0;

  Object.values(value).forEach((classBucket) => {
    if (typeof classBucket !== "object" || classBucket === null || Array.isArray(classBucket)) {
      return;
    }

    Object.values(classBucket).forEach((subclassBucket) => {
      if (typeof subclassBucket !== "object" || subclassBucket === null || Array.isArray(subclassBucket)) {
        return;
      }

      Object.values(subclassBucket).forEach((entries) => {
        if (typeof entries !== "object" || entries === null || Array.isArray(entries)) {
          return;
        }

        count += Object.keys(entries).length;
      });
    });
  });

  return count;
}

function readObjectArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null) : [];
}

function renderReferenceRows(
  entries: CompendiumReferenceEntry[],
  selected: CompendiumReferenceEntry | null,
  kind: Extract<CompendiumTab, "variantRules" | "conditions" | "optionalFeatures" | "actions" | "backgrounds" | "items" | "languages" | "races" | "skills">,
  setSelectedIds: Dispatch<SetStateAction<Record<AdminTab, string | null>>>,
  sourceBookNameById: Map<string, string>
) {
  return entries.map((entry) => (
    <button
      key={entry.id}
      type="button"
      className={`admin-list-row ${selected?.id === entry.id ? "is-selected" : ""}`}
      onClick={() => setSelectedIds((current) => ({ ...current, [kind]: entry.id }))}
    >
      <div className="admin-list-main">
        <strong>{entry.name}</strong>
        <small>{entry.category}</small>
      </div>
      <div className="admin-list-badges">
        <span className="badge subtle" title={sourceBookNameById.get(entry.source) ?? entry.source}>
          {entry.source}
        </span>
      </div>
    </button>
  ));
}

function renderBookRows(
  entries: CampaignSourceBook[],
  selected: CampaignSourceBook | null,
  setSelectedIds: Dispatch<SetStateAction<Record<AdminTab, string | null>>>
) {
  return entries.map((entry) => (
    <button
      key={entry.source}
      type="button"
      className={`admin-list-row ${selected?.source === entry.source ? "is-selected" : ""}`}
      onClick={() => setSelectedIds((current) => ({ ...current, books: entry.source }))}
    >
      <div className="admin-list-main">
        <strong>{entry.name}</strong>
        <small>{entry.group}</small>
      </div>
      <div className="admin-list-badges">
        <span className="badge subtle" title={entry.name}>
          {entry.source}
        </span>
        <span className="badge subtle">{entry.published || "Unknown"}</span>
      </div>
    </button>
  ));
}

function getAdminTabSourceOptions(
  tab: AdminTab,
  entries: {
    spells: SpellEntry[];
    monsters: Array<{ source: string }>;
    feats: Array<{ source: string }>;
    classes: Array<{ source: string }>;
    books: CampaignSourceBook[];
    variantRules: CompendiumReferenceEntry[];
    conditions: CompendiumReferenceEntry[];
    optionalFeatures: CompendiumReferenceEntry[];
    actions: CompendiumReferenceEntry[];
    backgrounds: CompendiumReferenceEntry[];
    items: CompendiumReferenceEntry[];
    languages: CompendiumReferenceEntry[];
    races: CompendiumReferenceEntry[];
    skills: CompendiumReferenceEntry[];
  }
) {
  switch (tab) {
    case "users":
      return [];
    case "books":
      return entries.books.map((entry) => ({ value: entry.source, label: entry.name }));
    case "spells":
      return uniqueOptionObjects(entries.spells.map((entry) => ({ value: normalizeSourceId(entry.source), label: entry.source })));
    case "monsters":
      return uniqueOptionObjects(entries.monsters.map((entry) => ({ value: normalizeSourceId(entry.source), label: entry.source })));
    case "feats":
      return uniqueOptionObjects(entries.feats.map((entry) => ({ value: normalizeSourceId(entry.source), label: entry.source })));
    case "classes":
      return uniqueOptionObjects(entries.classes.map((entry) => ({ value: normalizeSourceId(entry.source), label: entry.source })));
    case "variantRules":
    case "conditions":
    case "optionalFeatures":
    case "actions":
    case "backgrounds":
    case "items":
    case "languages":
    case "races":
    case "skills":
      return uniqueOptionObjects(entries[tab].map((entry) => ({ value: normalizeSourceId(entry.source), label: entry.source })));
  }
}

function getAdminTabTypeOptions(
  tab: AdminTab,
  entries: {
    spells: SpellEntry[];
    monsters: Array<{ challengeRating: string }>;
    feats: Array<{ category: string }>;
    classes: Array<unknown>;
    books: CampaignSourceBook[];
    variantRules: CompendiumReferenceEntry[];
    conditions: CompendiumReferenceEntry[];
    optionalFeatures: CompendiumReferenceEntry[];
    actions: CompendiumReferenceEntry[];
    backgrounds: CompendiumReferenceEntry[];
    items: CompendiumReferenceEntry[];
    languages: CompendiumReferenceEntry[];
    races: CompendiumReferenceEntry[];
    skills: CompendiumReferenceEntry[];
  }
) {
  switch (tab) {
    case "users":
    case "classes":
      return [];
    case "spells":
      return uniqueStrings(entries.spells.map((entry) => entry.school));
    case "monsters":
      return uniqueStrings(entries.monsters.map((entry) => entry.challengeRating));
    case "feats":
      return uniqueStrings(entries.feats.map((entry) => entry.category));
    case "books":
      return uniqueStrings(entries.books.map((entry) => entry.group));
    case "variantRules":
    case "conditions":
    case "optionalFeatures":
    case "actions":
    case "backgrounds":
    case "items":
    case "languages":
    case "races":
    case "skills":
      return uniqueStrings(entries[tab].map((entry) => entry.category));
  }
}

function getAdminTabSecondaryTypeOptions(
  tab: AdminTab,
  entries: {
    spells: SpellEntry[];
    monsters: Array<{ creatureType: string }>;
  }
) {
  switch (tab) {
    case "spells":
      return uniqueStrings(entries.spells.map((entry) => String(entry.level)));
    case "monsters":
      return uniqueStrings(entries.monsters.map((entry) => entry.creatureType));
    default:
      return [];
  }
}

function getSortOptionsForTab(tab: AdminTab): Array<{ value: ListSort; label: string }> {
  switch (tab) {
    case "users":
      return [{ value: "name-asc", label: "Name A-Z" }];
    case "spells":
      return [
        { value: "name-asc", label: "Name A-Z" },
        { value: "source-asc", label: "Source A-Z" },
        { value: "level-asc", label: "Level Low-High" },
        { value: "level-desc", label: "Level High-Low" }
      ];
    case "monsters":
      return [
        { value: "name-asc", label: "Name A-Z" },
        { value: "source-asc", label: "Source A-Z" },
        { value: "cr-asc", label: "CR Low-High" },
        { value: "cr-desc", label: "CR High-Low" }
      ];
    case "books":
      return [
        { value: "published-desc", label: "Published New-Old" },
        { value: "published-asc", label: "Published Old-New" },
        { value: "name-asc", label: "Name A-Z" },
        { value: "source-asc", label: "ID A-Z" }
      ];
    case "classes":
      return [
        { value: "name-asc", label: "Name A-Z" },
        { value: "source-asc", label: "Source A-Z" }
      ];
    default:
      return [
        { value: "name-asc", label: "Name A-Z" },
        { value: "source-asc", label: "Source A-Z" },
        { value: "category-asc", label: "Category A-Z" }
      ];
  }
}

function filterAndSortSpells(entries: SpellEntry[], controls: ListControlsState) {
  return [...entries]
    .filter((entry) => !controls.source || normalizeSourceId(entry.source) === controls.source)
    .filter((entry) => !controls.type || entry.school === controls.type)
    .filter((entry) => !controls.secondaryType || String(entry.level) === controls.secondaryType)
    .sort((left, right) =>
      compareValues(left, right, controls.sort, {
        categoryLeft: left.school,
        categoryRight: right.school,
        levelLeft: left.level === "cantrip" ? 0 : left.level,
        levelRight: right.level === "cantrip" ? 0 : right.level
      })
    );
}

function filterAndSortMonsters<T extends { id: string; name: string; source: string; challengeRating: string; creatureType: string }>(
  entries: T[],
  controls: ListControlsState
) {
  return [...entries]
    .filter((entry) => !controls.source || normalizeSourceId(entry.source) === controls.source)
    .filter((entry) => !controls.type || entry.challengeRating === controls.type)
    .filter((entry) => !controls.secondaryType || entry.creatureType === controls.secondaryType)
    .sort((left, right) =>
      compareValues(left, right, controls.sort, {
        categoryLeft: left.challengeRating,
        categoryRight: right.challengeRating,
        crLeft: parseChallengeRating(left.challengeRating),
        crRight: parseChallengeRating(right.challengeRating)
      })
    );
}

function filterAndSortClasses<T extends { name: string; source: string }>(entries: T[], controls: ListControlsState) {
  return [...entries]
    .filter((entry) => !controls.source || normalizeSourceId(entry.source) === controls.source)
    .sort((left, right) => compareValues(left, right, controls.sort));
}

function filterAndSortReferences<T extends { name: string; source: string; category: string }>(entries: T[], controls: ListControlsState) {
  return [...entries]
    .filter((entry) => !controls.source || normalizeSourceId(entry.source) === controls.source)
    .filter((entry) => !controls.type || entry.category === controls.type)
    .sort((left, right) =>
      compareValues(left, right, controls.sort, {
        categoryLeft: left.category,
        categoryRight: right.category
      })
    );
}

function filterAndSortBooks(entries: CampaignSourceBook[], controls: ListControlsState) {
  return [...entries]
    .filter((entry) => !controls.source || entry.source === controls.source)
    .filter((entry) => !controls.type || entry.group === controls.type)
    .sort((left, right) =>
      compareValues(left, right, controls.sort, {
        categoryLeft: left.group,
        categoryRight: right.group,
        publishedLeft: left.published,
        publishedRight: right.published
      })
    );
}

function compareValues(
  left: { name: string; source: string },
  right: { name: string; source: string },
  sort: ListSort,
  extra?: {
    categoryLeft?: string;
    categoryRight?: string;
    publishedLeft?: string;
    publishedRight?: string;
    levelLeft?: number;
    levelRight?: number;
    crLeft?: number;
    crRight?: number;
  }
) {
  switch (sort) {
    case "name-desc":
      return right.name.localeCompare(left.name);
    case "source-asc":
      return left.source.localeCompare(right.source) || left.name.localeCompare(right.name);
    case "source-desc":
      return right.source.localeCompare(left.source) || left.name.localeCompare(right.name);
    case "category-asc":
      return (extra?.categoryLeft ?? "").localeCompare(extra?.categoryRight ?? "") || left.name.localeCompare(right.name);
    case "category-desc":
      return (extra?.categoryRight ?? "").localeCompare(extra?.categoryLeft ?? "") || left.name.localeCompare(right.name);
    case "published-asc":
      return (extra?.publishedLeft ?? "").localeCompare(extra?.publishedRight ?? "") || left.name.localeCompare(right.name);
    case "published-desc":
      return (extra?.publishedRight ?? "").localeCompare(extra?.publishedLeft ?? "") || left.name.localeCompare(right.name);
    case "level-asc":
      return (extra?.levelLeft ?? 0) - (extra?.levelRight ?? 0) || left.name.localeCompare(right.name);
    case "level-desc":
      return (extra?.levelRight ?? 0) - (extra?.levelLeft ?? 0) || left.name.localeCompare(right.name);
    case "cr-asc":
      return (extra?.crLeft ?? 0) - (extra?.crRight ?? 0) || left.name.localeCompare(right.name);
    case "cr-desc":
      return (extra?.crRight ?? 0) - (extra?.crLeft ?? 0) || left.name.localeCompare(right.name);
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

function getPrimaryFilterLabel(tab: AdminTab) {
  switch (tab) {
    case "books":
      return "Group";
    case "spells":
      return "School";
    case "monsters":
      return "CR";
    default:
      return "Category";
  }
}

function getPrimaryFilterEmptyLabel(tab: AdminTab) {
  switch (tab) {
    case "books":
      return "All groups";
    case "spells":
      return "All schools";
    case "monsters":
      return "All CR";
    default:
      return "All categories";
  }
}

function getSecondaryFilterLabel(tab: AdminTab) {
  switch (tab) {
    case "spells":
      return "Level";
    case "monsters":
      return "Type";
    default:
      return "Type";
  }
}

function getSecondaryFilterEmptyLabel(tab: AdminTab) {
  switch (tab) {
    case "spells":
      return "All levels";
    case "monsters":
      return "All monster types";
    default:
      return "All types";
  }
}

function normalizeSourceId(source: string) {
  return source.split(/\s+p\.\d+/i)[0]?.trim() ?? source.trim();
}

function uniqueOptionObjects(values: Array<{ value: string; label: string }>) {
  const seen = new Set<string>();
  return values
    .filter((entry) => {
      if (!entry.value || seen.has(entry.value)) {
        return false;
      }

      seen.add(entry.value);
      return true;
    })
    .sort((left, right) => left.value.localeCompare(right.value));
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function formatMonsterTokenArchiveSummary(
  fileName: string,
  result: {
    processedFiles: number;
    matchedFiles: number;
    updatedMonsters: number;
    ignoredEntries: number;
    unmatchedFiles: string[];
  }
) {
  const details = [
    `${fileName}: updated ${result.updatedMonsters} monsters from ${result.matchedFiles}/${result.processedFiles} image files`
  ];

  if (result.unmatchedFiles.length > 0) {
    details.push(`${result.unmatchedFiles.length} files did not match a monster name`);
  }

  if (result.ignoredEntries > 0) {
    details.push(`${result.ignoredEntries} archive entries were ignored`);
  }

  return `${details.join(". ")}.`;
}

function resolveSelectedByKey<T>(entries: T[], selectedKey: string | null, readKey: (entry: T) => string) {
  return entries.find((entry) => readKey(entry) === selectedKey) ?? entries[0] ?? null;
}
