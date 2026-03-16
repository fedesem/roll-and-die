import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

import type {
  AbilityKey,
  ActorKind,
  ActorSheet,
  ArmorEntry,
  AttackEntry,
  Campaign,
  CampaignInvite,
  CampaignMap,
  CampaignMember,
  ChatMessage,
  CurrencyPouch,
  DiceRoll,
  DrawingStroke,
  InventoryEntry,
  MapWall,
  MemberRole,
  ResourceEntry,
  SkillEntry,
  SpellSlotTrack,
  UserProfile
} from "../../shared/types.js";

export interface StoredUser extends UserProfile {
  passwordHash: string;
  salt: string;
}

export interface SessionRecord {
  token: string;
  userId: string;
  createdAt: string;
}

export interface Database {
  users: StoredUser[];
  sessions: SessionRecord[];
  campaigns: Campaign[];
}

interface PersistenceAdapter {
  initialize(): Promise<void>;
  read(): Promise<Database>;
  write(database: Database): Promise<void>;
}

interface Migration {
  version: number;
  name: string;
  up(database: DatabaseSync): Promise<void> | void;
}

const sqlitePath = resolve(process.cwd(), "data", "app.sqlite");
const legacyJsonPath = resolve(process.cwd(), "data", "db.json");

const defaultDatabase: Database = {
  users: [],
  sessions: [],
  campaigns: []
};

const migrations: Migration[] = [
  {
    version: 1,
    name: "create_relational_schema",
    up(database) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS campaigns (
          id TEXT PRIMARY KEY,
          sort_order INTEGER NOT NULL,
          name TEXT NOT NULL,
          created_at TEXT NOT NULL,
          created_by TEXT NOT NULL REFERENCES users(id),
          active_map_id TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS campaign_members (
          campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL REFERENCES users(id),
          sort_order INTEGER NOT NULL,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('dm', 'player')),
          PRIMARY KEY (campaign_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS campaign_invites (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
          sort_order INTEGER NOT NULL,
          code TEXT NOT NULL UNIQUE,
          label TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('dm', 'player')),
          created_at TEXT NOT NULL,
          created_by TEXT NOT NULL REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS actors (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
          sort_order INTEGER NOT NULL,
          owner_id TEXT REFERENCES users(id),
          template_id TEXT,
          name TEXT NOT NULL,
          kind TEXT NOT NULL CHECK (kind IN ('character', 'npc', 'monster')),
          class_name TEXT NOT NULL,
          species TEXT NOT NULL,
          background TEXT NOT NULL,
          alignment TEXT NOT NULL,
          level INTEGER NOT NULL,
          challenge_rating TEXT NOT NULL,
          experience INTEGER NOT NULL,
          spellcasting_ability TEXT NOT NULL,
          armor_class INTEGER NOT NULL,
          initiative INTEGER NOT NULL,
          speed INTEGER NOT NULL,
          proficiency_bonus INTEGER NOT NULL,
          inspiration INTEGER NOT NULL,
          vision_range INTEGER NOT NULL,
          hit_points_current INTEGER NOT NULL,
          hit_points_max INTEGER NOT NULL,
          hit_points_temp INTEGER NOT NULL,
          hit_dice TEXT NOT NULL,
          ability_str INTEGER NOT NULL,
          ability_dex INTEGER NOT NULL,
          ability_con INTEGER NOT NULL,
          ability_int INTEGER NOT NULL,
          ability_wis INTEGER NOT NULL,
          ability_cha INTEGER NOT NULL,
          currency_pp INTEGER NOT NULL,
          currency_gp INTEGER NOT NULL,
          currency_ep INTEGER NOT NULL,
          currency_sp INTEGER NOT NULL,
          currency_cp INTEGER NOT NULL,
          notes TEXT NOT NULL,
          color TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS actor_skills (
          actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
          id TEXT NOT NULL,
          sort_order INTEGER NOT NULL,
          name TEXT NOT NULL,
          ability TEXT NOT NULL,
          proficient INTEGER NOT NULL,
          expertise INTEGER NOT NULL,
          PRIMARY KEY (actor_id, id)
        );

        CREATE TABLE IF NOT EXISTS actor_spell_slots (
          actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
          level INTEGER NOT NULL,
          total INTEGER NOT NULL,
          used INTEGER NOT NULL,
          PRIMARY KEY (actor_id, level)
        );

        CREATE TABLE IF NOT EXISTS actor_text_entries (
          actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
          kind TEXT NOT NULL CHECK (kind IN ('features', 'spells', 'talents', 'feats')),
          sort_order INTEGER NOT NULL,
          value TEXT NOT NULL,
          PRIMARY KEY (actor_id, kind, sort_order)
        );

        CREATE TABLE IF NOT EXISTS actor_attacks (
          actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
          id TEXT NOT NULL,
          sort_order INTEGER NOT NULL,
          name TEXT NOT NULL,
          attack_bonus INTEGER NOT NULL,
          damage TEXT NOT NULL,
          damage_type TEXT NOT NULL,
          notes TEXT NOT NULL,
          PRIMARY KEY (actor_id, id)
        );

        CREATE TABLE IF NOT EXISTS actor_armor_items (
          actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
          id TEXT NOT NULL,
          sort_order INTEGER NOT NULL,
          name TEXT NOT NULL,
          armor_class INTEGER NOT NULL,
          notes TEXT NOT NULL,
          PRIMARY KEY (actor_id, id)
        );

        CREATE TABLE IF NOT EXISTS actor_resources (
          actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
          id TEXT NOT NULL,
          sort_order INTEGER NOT NULL,
          name TEXT NOT NULL,
          current_value INTEGER NOT NULL,
          max_value INTEGER NOT NULL,
          reset_on TEXT NOT NULL,
          PRIMARY KEY (actor_id, id)
        );

        CREATE TABLE IF NOT EXISTS actor_inventory (
          actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
          id TEXT NOT NULL,
          sort_order INTEGER NOT NULL,
          name TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          PRIMARY KEY (actor_id, id)
        );

        CREATE TABLE IF NOT EXISTS maps (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
          sort_order INTEGER NOT NULL,
          name TEXT NOT NULL,
          background_url TEXT NOT NULL,
          background_offset_x REAL NOT NULL DEFAULT 0,
          background_offset_y REAL NOT NULL DEFAULT 0,
          background_scale REAL NOT NULL DEFAULT 1,
          width INTEGER NOT NULL,
          height INTEGER NOT NULL,
          grid_show INTEGER NOT NULL,
          grid_cell_size INTEGER NOT NULL,
          grid_scale REAL NOT NULL,
          grid_offset_x REAL NOT NULL,
          grid_offset_y REAL NOT NULL,
          grid_color TEXT NOT NULL,
          visibility_version INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS map_walls (
          id TEXT PRIMARY KEY,
          map_id TEXT NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
          sort_order INTEGER NOT NULL,
          start_x REAL NOT NULL,
          start_y REAL NOT NULL,
          end_x REAL NOT NULL,
          end_y REAL NOT NULL,
          kind TEXT NOT NULL DEFAULT 'wall' CHECK (kind IN ('wall', 'transparent', 'door')),
          is_open INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS map_drawings (
          id TEXT PRIMARY KEY,
          map_id TEXT NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
          sort_order INTEGER NOT NULL,
          color TEXT NOT NULL,
          size REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS map_drawing_points (
          stroke_id TEXT NOT NULL REFERENCES map_drawings(id) ON DELETE CASCADE,
          sort_order INTEGER NOT NULL,
          x REAL NOT NULL,
          y REAL NOT NULL,
          PRIMARY KEY (stroke_id, sort_order)
        );

        CREATE TABLE IF NOT EXISTS tokens (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
          sort_order INTEGER NOT NULL,
          actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
          actor_kind TEXT NOT NULL CHECK (actor_kind IN ('character', 'npc', 'monster')),
          map_id TEXT NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
          x REAL NOT NULL,
          y REAL NOT NULL,
          size REAL NOT NULL,
          color TEXT NOT NULL,
          label TEXT NOT NULL,
          visible INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS chat_messages (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
          sort_order INTEGER NOT NULL,
          user_id TEXT NOT NULL REFERENCES users(id),
          user_name TEXT NOT NULL,
          text TEXT NOT NULL,
          created_at TEXT NOT NULL,
          kind TEXT NOT NULL CHECK (kind IN ('message', 'roll', 'system'))
        );

        CREATE TABLE IF NOT EXISTS chat_rolls (
          id TEXT PRIMARY KEY,
          message_id TEXT NOT NULL UNIQUE REFERENCES chat_messages(id) ON DELETE CASCADE,
          label TEXT NOT NULL,
          notation TEXT NOT NULL,
          modifier INTEGER NOT NULL,
          total INTEGER NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS chat_roll_values (
          roll_id TEXT NOT NULL REFERENCES chat_rolls(id) ON DELETE CASCADE,
          sort_order INTEGER NOT NULL,
          value INTEGER NOT NULL,
          PRIMARY KEY (roll_id, sort_order)
        );

        CREATE TABLE IF NOT EXISTS exploration_cells (
          campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL REFERENCES users(id),
          map_id TEXT NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
          column_index INTEGER NOT NULL,
          row_index INTEGER NOT NULL,
          PRIMARY KEY (campaign_id, user_id, map_id, column_index, row_index)
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_campaign_members_campaign ON campaign_members(campaign_id);
        CREATE INDEX IF NOT EXISTS idx_campaign_invites_campaign ON campaign_invites(campaign_id);
        CREATE INDEX IF NOT EXISTS idx_actors_campaign ON actors(campaign_id);
        CREATE INDEX IF NOT EXISTS idx_maps_campaign ON maps(campaign_id);
        CREATE INDEX IF NOT EXISTS idx_tokens_campaign ON tokens(campaign_id);
        CREATE INDEX IF NOT EXISTS idx_chat_messages_campaign ON chat_messages(campaign_id);
        CREATE INDEX IF NOT EXISTS idx_exploration_campaign ON exploration_cells(campaign_id);
      `);
    }
  },
  {
    version: 2,
    name: "import_legacy_blob_or_json",
    async up(database) {
      if (hasRelationalData(database)) {
        return;
      }

      const legacy = await loadLegacyDatabase(database);
      writeRelationalDatabase(database, legacy);
    }
  },
  {
    version: 3,
    name: "drop_legacy_blob_table",
    up(database) {
      database.exec("DROP TABLE IF EXISTS app_state;");
    }
  },
  {
    version: 4,
    name: "add_map_background_alignment",
    up(database) {
      addColumnIfMissing(database, "maps", "background_offset_x", "REAL NOT NULL DEFAULT 0");
      addColumnIfMissing(database, "maps", "background_offset_y", "REAL NOT NULL DEFAULT 0");
      addColumnIfMissing(database, "maps", "background_scale", "REAL NOT NULL DEFAULT 1");
    }
  },
  {
    version: 5,
    name: "add_map_obstacle_metadata",
    up(database) {
      addColumnIfMissing(
        database,
        "map_walls",
        "kind",
        "TEXT NOT NULL DEFAULT 'wall' CHECK (kind IN ('wall', 'transparent', 'door'))"
      );
      addColumnIfMissing(database, "map_walls", "is_open", "INTEGER NOT NULL DEFAULT 0");
      addColumnIfMissing(database, "maps", "visibility_version", "INTEGER NOT NULL DEFAULT 1");
      database.exec("UPDATE maps SET visibility_version = COALESCE(visibility_version, 1);");
      database.exec("UPDATE map_walls SET kind = COALESCE(kind, 'wall');");
      database.exec("UPDATE map_walls SET is_open = COALESCE(is_open, 0);");
    }
  }
];

class SqlitePersistenceAdapter implements PersistenceAdapter {
  private database: DatabaseSync | null = null;
  private initialized = false;

  async initialize() {
    if (this.initialized) {
      return;
    }

    await mkdir(dirname(sqlitePath), { recursive: true });
    this.database = new DatabaseSync(sqlitePath);
    this.database.exec("PRAGMA foreign_keys = ON;");
    this.database.exec("PRAGMA journal_mode = WAL;");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);

    const database = this.getDatabase();
    const applied = new Set(
      readAll<{ version: number }>(database, "SELECT version FROM schema_migrations ORDER BY version").map(
        (row) => row.version
      )
    );

    for (const migration of migrations) {
      if (applied.has(migration.version)) {
        continue;
      }

      await runInTransaction(database, async () => {
        await migration.up(database);
        database
          .prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)")
          .run(migration.version, migration.name, new Date().toISOString());
      });
    }

    this.initialized = true;
  }

  async read() {
    await this.initialize();
    return readRelationalDatabase(this.getDatabase());
  }

  async write(database: Database) {
    await this.initialize();
    await runInTransaction(this.getDatabase(), () => {
      writeRelationalDatabase(this.getDatabase(), database);
    });
  }

  private getDatabase() {
    if (!this.database) {
      throw new Error("SQLite adapter not initialized.");
    }

    return this.database;
  }
}

function createPersistenceAdapter(): PersistenceAdapter {
  const driver = process.env.DB_DRIVER ?? "sqlite";

  if (driver !== "sqlite") {
    throw new Error(`Unsupported DB driver "${driver}".`);
  }

  return new SqlitePersistenceAdapter();
}

const adapter = createPersistenceAdapter();
let writeQueue: Promise<unknown> = Promise.resolve();

export async function readDatabase(): Promise<Database> {
  return adapter.read();
}

export async function mutateDatabase<T>(mutator: (database: Database) => Promise<T> | T): Promise<T> {
  const task = writeQueue.then(async () => {
    const database = await adapter.read();
    const result = await mutator(database);
    await adapter.write(database);
    return result;
  });

  writeQueue = task.then(
    () => undefined,
    () => undefined
  );

  return task;
}

function normalizeDatabase(database: Database): Database {
  return {
    users: Array.isArray(database.users) ? database.users : [],
    sessions: Array.isArray(database.sessions) ? database.sessions : [],
    campaigns: Array.isArray(database.campaigns) ? database.campaigns.map(normalizeCampaign) : []
  };
}

function normalizeCampaign(campaign: Campaign): Campaign {
  const maps = Array.isArray(campaign.maps)
    ? campaign.maps.map((map) => ({
        ...map,
        backgroundOffsetX: map.backgroundOffsetX ?? 0,
        backgroundOffsetY: map.backgroundOffsetY ?? 0,
        backgroundScale: map.backgroundScale ?? 1,
        fog: [],
        visibilityVersion: map.visibilityVersion ?? 1,
        walls: Array.isArray(map.walls)
          ? map.walls.map((wall) => ({
              ...wall,
              kind: wall.kind ?? "wall",
              isOpen: wall.kind === "door" ? Boolean(wall.isOpen) : false
            }))
          : []
      }))
    : [];
  const activeMapId = campaign.activeMapId || maps[0]?.id || "";

  return {
    ...campaign,
    activeMapId,
    exploration: campaign.exploration ?? {},
    actors: Array.isArray(campaign.actors)
      ? campaign.actors.map((actor) => ({
          ...actor,
          visionRange: actor.visionRange ?? 6
        }))
      : [],
    maps,
    tokens: Array.isArray(campaign.tokens) ? campaign.tokens : [],
    chat: Array.isArray(campaign.chat) ? campaign.chat : [],
    invites: Array.isArray(campaign.invites) ? campaign.invites : [],
    members: Array.isArray(campaign.members) ? campaign.members : []
  };
}

async function runInTransaction<T>(database: DatabaseSync, task: () => Promise<T> | T) {
  database.exec("BEGIN IMMEDIATE");

  try {
    const result = await task();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function addColumnIfMissing(database: DatabaseSync, tableName: string, columnName: string, definition: string) {
  const columns = readAll<{ name: string }>(database, `PRAGMA table_info(${tableName})`);

  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

function hasRelationalData(database: DatabaseSync) {
  return (
    readCount(database, "users") > 0 || readCount(database, "sessions") > 0 || readCount(database, "campaigns") > 0
  );
}

function readCount(database: DatabaseSync, table: string) {
  const row = database.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
  return row.count;
}

async function loadLegacyDatabase(database: DatabaseSync) {
  const fromBlob = loadLegacyBlob(database);

  if (fromBlob) {
    return fromBlob;
  }

  if (!existsSync(legacyJsonPath)) {
    return defaultDatabase;
  }

  try {
    const raw = await readFile(legacyJsonPath, "utf8");
    return normalizeDatabase(JSON.parse(raw) as Database);
  } catch {
    return defaultDatabase;
  }
}

function loadLegacyBlob(database: DatabaseSync) {
  if (!tableExists(database, "app_state")) {
    return null;
  }

  const row = database.prepare("SELECT data FROM app_state WHERE id = 1").get() as { data: string } | undefined;

  if (!row?.data) {
    return null;
  }

  try {
    return normalizeDatabase(JSON.parse(row.data) as Database);
  } catch {
    return null;
  }
}

function tableExists(database: DatabaseSync, tableName: string) {
  const row = database
    .prepare("SELECT 1 as found FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
    .get(tableName) as { found: number } | undefined;

  return Boolean(row?.found);
}

function readRelationalDatabase(database: DatabaseSync): Database {
  const users = readAll<{
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    salt: string;
  }>(
    database,
    `
      SELECT id, name, email, password_hash as passwordHash, salt
      FROM users
      ORDER BY id
    `
  ).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.passwordHash,
    salt: row.salt
  }));

  const sessions = readAll<{
    token: string;
    userId: string;
    createdAt: string;
  }>(
    database,
    `
      SELECT token, user_id as userId, created_at as createdAt
      FROM sessions
      ORDER BY created_at, token
    `
  );

  const campaigns = readAll<{
    id: string;
    name: string;
    createdAt: string;
    createdBy: string;
    activeMapId: string;
  }>(
    database,
    `
      SELECT id, name, created_at as createdAt, created_by as createdBy, active_map_id as activeMapId
      FROM campaigns
      ORDER BY sort_order, created_at, id
    `
  ).map<Campaign>((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    activeMapId: row.activeMapId,
    members: [],
    invites: [],
    actors: [],
    maps: [],
    tokens: [],
    chat: [],
    exploration: {}
  }));

  const campaignsById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const actorsById = new Map<string, ActorSheet>();
  const mapsById = new Map<string, CampaignMap>();
  const drawingsById = new Map<string, DrawingStroke>();
  const messagesById = new Map<string, ChatMessage>();
  const rollsById = new Map<string, DiceRoll>();

  for (const row of readAll<{
    campaignId: string;
    userId: string;
    name: string;
    email: string;
    role: MemberRole;
  }>(
    database,
    `
      SELECT campaign_id as campaignId, user_id as userId, name, email, role
      FROM campaign_members
      ORDER BY campaign_id, sort_order, user_id
    `
  )) {
    campaignsById.get(row.campaignId)?.members.push({
      userId: row.userId,
      name: row.name,
      email: row.email,
      role: row.role
    } satisfies CampaignMember);
  }

  for (const row of readAll<{
    id: string;
    campaignId: string;
    code: string;
    label: string;
    role: MemberRole;
    createdAt: string;
    createdBy: string;
  }>(
    database,
    `
      SELECT id, campaign_id as campaignId, code, label, role, created_at as createdAt, created_by as createdBy
      FROM campaign_invites
      ORDER BY campaign_id, sort_order, id
    `
  )) {
    campaignsById.get(row.campaignId)?.invites.push({
      id: row.id,
      code: row.code,
      label: row.label,
      role: row.role,
      createdAt: row.createdAt,
      createdBy: row.createdBy
    } satisfies CampaignInvite);
  }

  for (const row of readAll<{
    id: string;
    campaignId: string;
    ownerId: string | null;
    templateId: string | null;
    name: string;
    kind: ActorKind;
    className: string;
    species: string;
    background: string;
    alignment: string;
    level: number;
    challengeRating: string;
    experience: number;
    spellcastingAbility: AbilityKey;
    armorClass: number;
    initiative: number;
    speed: number;
    proficiencyBonus: number;
    inspiration: number;
    visionRange: number;
    hitPointsCurrent: number;
    hitPointsMax: number;
    hitPointsTemp: number;
    hitDice: string;
    abilityStr: number;
    abilityDex: number;
    abilityCon: number;
    abilityInt: number;
    abilityWis: number;
    abilityCha: number;
    currencyPp: number;
    currencyGp: number;
    currencyEp: number;
    currencySp: number;
    currencyCp: number;
    notes: string;
    color: string;
  }>(
    database,
    `
      SELECT
        id,
        campaign_id as campaignId,
        owner_id as ownerId,
        template_id as templateId,
        name,
        kind,
        class_name as className,
        species,
        background,
        alignment,
        level,
        challenge_rating as challengeRating,
        experience,
        spellcasting_ability as spellcastingAbility,
        armor_class as armorClass,
        initiative,
        speed,
        proficiency_bonus as proficiencyBonus,
        inspiration,
        vision_range as visionRange,
        hit_points_current as hitPointsCurrent,
        hit_points_max as hitPointsMax,
        hit_points_temp as hitPointsTemp,
        hit_dice as hitDice,
        ability_str as abilityStr,
        ability_dex as abilityDex,
        ability_con as abilityCon,
        ability_int as abilityInt,
        ability_wis as abilityWis,
        ability_cha as abilityCha,
        currency_pp as currencyPp,
        currency_gp as currencyGp,
        currency_ep as currencyEp,
        currency_sp as currencySp,
        currency_cp as currencyCp,
        notes,
        color
      FROM actors
      ORDER BY campaign_id, sort_order, id
    `
  )) {
    const actor: ActorSheet = {
      id: row.id,
      campaignId: row.campaignId,
      ownerId: row.ownerId ?? undefined,
      templateId: row.templateId ?? undefined,
      name: row.name,
      kind: row.kind,
      className: row.className,
      species: row.species,
      background: row.background,
      alignment: row.alignment,
      level: row.level,
      challengeRating: row.challengeRating,
      experience: row.experience,
      spellcastingAbility: row.spellcastingAbility,
      armorClass: row.armorClass,
      initiative: row.initiative,
      speed: row.speed,
      proficiencyBonus: row.proficiencyBonus,
      inspiration: toBoolean(row.inspiration),
      visionRange: row.visionRange,
      hitPoints: {
        current: row.hitPointsCurrent,
        max: row.hitPointsMax,
        temp: row.hitPointsTemp
      },
      hitDice: row.hitDice,
      abilities: {
        str: row.abilityStr,
        dex: row.abilityDex,
        con: row.abilityCon,
        int: row.abilityInt,
        wis: row.abilityWis,
        cha: row.abilityCha
      },
      skills: [],
      spellSlots: [],
      features: [],
      spells: [],
      talents: [],
      feats: [],
      attacks: [],
      armorItems: [],
      resources: [],
      inventory: [],
      currency: {
        pp: row.currencyPp,
        gp: row.currencyGp,
        ep: row.currencyEp,
        sp: row.currencySp,
        cp: row.currencyCp
      },
      notes: row.notes,
      color: row.color
    };

    campaignsById.get(row.campaignId)?.actors.push(actor);
    actorsById.set(actor.id, actor);
  }

  for (const row of readAll<{
    actorId: string;
    id: string;
    name: string;
    ability: AbilityKey;
    proficient: number;
    expertise: number;
  }>(
    database,
    `
      SELECT actor_id as actorId, id, name, ability, proficient, expertise
      FROM actor_skills
      ORDER BY actor_id, sort_order, id
    `
  )) {
    actorsById.get(row.actorId)?.skills.push({
      id: row.id,
      name: row.name,
      ability: row.ability,
      proficient: toBoolean(row.proficient),
      expertise: toBoolean(row.expertise)
    } satisfies SkillEntry);
  }

  for (const row of readAll<{
    actorId: string;
    level: number;
    total: number;
    used: number;
  }>(
    database,
    `
      SELECT actor_id as actorId, level, total, used
      FROM actor_spell_slots
      ORDER BY actor_id, level
    `
  )) {
    actorsById.get(row.actorId)?.spellSlots.push({
      level: row.level,
      total: row.total,
      used: row.used
    } satisfies SpellSlotTrack);
  }

  for (const row of readAll<{
    actorId: string;
    kind: "features" | "spells" | "talents" | "feats";
    value: string;
  }>(
    database,
    `
      SELECT actor_id as actorId, kind, value
      FROM actor_text_entries
      ORDER BY actor_id, kind, sort_order
    `
  )) {
    const actor = actorsById.get(row.actorId);

    if (!actor) {
      continue;
    }

    actor[row.kind].push(row.value);
  }

  for (const row of readAll<{
    actorId: string;
    id: string;
    name: string;
    attackBonus: number;
    damage: string;
    damageType: string;
    notes: string;
  }>(
    database,
    `
      SELECT
        actor_id as actorId,
        id,
        name,
        attack_bonus as attackBonus,
        damage,
        damage_type as damageType,
        notes
      FROM actor_attacks
      ORDER BY actor_id, sort_order, id
    `
  )) {
    actorsById.get(row.actorId)?.attacks.push({
      id: row.id,
      name: row.name,
      attackBonus: row.attackBonus,
      damage: row.damage,
      damageType: row.damageType,
      notes: row.notes
    } satisfies AttackEntry);
  }

  for (const row of readAll<{
    actorId: string;
    id: string;
    name: string;
    armorClass: number;
    notes: string;
  }>(
    database,
    `
      SELECT actor_id as actorId, id, name, armor_class as armorClass, notes
      FROM actor_armor_items
      ORDER BY actor_id, sort_order, id
    `
  )) {
    actorsById.get(row.actorId)?.armorItems.push({
      id: row.id,
      name: row.name,
      armorClass: row.armorClass,
      notes: row.notes
    } satisfies ArmorEntry);
  }

  for (const row of readAll<{
    actorId: string;
    id: string;
    name: string;
    current: number;
    max: number;
    resetOn: string;
  }>(
    database,
    `
      SELECT
        actor_id as actorId,
        id,
        name,
        current_value as current,
        max_value as max,
        reset_on as resetOn
      FROM actor_resources
      ORDER BY actor_id, sort_order, id
    `
  )) {
    actorsById.get(row.actorId)?.resources.push({
      id: row.id,
      name: row.name,
      current: row.current,
      max: row.max,
      resetOn: row.resetOn
    } satisfies ResourceEntry);
  }

  for (const row of readAll<{
    actorId: string;
    id: string;
    name: string;
    quantity: number;
  }>(
    database,
    `
      SELECT actor_id as actorId, id, name, quantity
      FROM actor_inventory
      ORDER BY actor_id, sort_order, id
    `
  )) {
    actorsById.get(row.actorId)?.inventory.push({
      id: row.id,
      name: row.name,
      quantity: row.quantity
    } satisfies InventoryEntry);
  }

  for (const row of readAll<{
    id: string;
    campaignId: string;
    name: string;
    backgroundUrl: string;
    backgroundOffsetX: number;
    backgroundOffsetY: number;
    backgroundScale: number;
    width: number;
    height: number;
    gridShow: number;
    gridCellSize: number;
    gridScale: number;
    gridOffsetX: number;
    gridOffsetY: number;
    gridColor: string;
    visibilityVersion: number;
  }>(
    database,
    `
      SELECT
        id,
        campaign_id as campaignId,
        name,
        background_url as backgroundUrl,
        background_offset_x as backgroundOffsetX,
        background_offset_y as backgroundOffsetY,
        background_scale as backgroundScale,
        width,
        height,
        grid_show as gridShow,
        grid_cell_size as gridCellSize,
        grid_scale as gridScale,
        grid_offset_x as gridOffsetX,
        grid_offset_y as gridOffsetY,
        grid_color as gridColor,
        visibility_version as visibilityVersion
      FROM maps
      ORDER BY campaign_id, sort_order, id
    `
  )) {
    const map: CampaignMap = {
      id: row.id,
      name: row.name,
      backgroundUrl: row.backgroundUrl,
      backgroundOffsetX: row.backgroundOffsetX,
      backgroundOffsetY: row.backgroundOffsetY,
      backgroundScale: row.backgroundScale,
      width: row.width,
      height: row.height,
      grid: {
        show: toBoolean(row.gridShow),
        cellSize: row.gridCellSize,
        scale: row.gridScale,
        offsetX: row.gridOffsetX,
        offsetY: row.gridOffsetY,
        color: row.gridColor
      },
      walls: [],
      drawings: [],
      fog: [],
      visibilityVersion: row.visibilityVersion ?? 1
    };

    campaignsById.get(row.campaignId)?.maps.push(map);
    mapsById.set(map.id, map);
  }

  for (const row of readAll<{
    id: string;
    mapId: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    kind: "wall" | "transparent" | "door";
    isOpen: number;
  }>(
    database,
    `
      SELECT
        id,
        map_id as mapId,
        start_x as startX,
        start_y as startY,
        end_x as endX,
        end_y as endY,
        kind,
        is_open as isOpen
      FROM map_walls
      ORDER BY map_id, sort_order, id
    `
  )) {
    mapsById.get(row.mapId)?.walls.push({
      id: row.id,
      start: { x: row.startX, y: row.startY },
      end: { x: row.endX, y: row.endY },
      kind: row.kind ?? "wall",
      isOpen: Boolean(row.isOpen)
    } satisfies MapWall);
  }

  for (const row of readAll<{
    id: string;
    mapId: string;
    color: string;
    size: number;
  }>(
    database,
    `
      SELECT id, map_id as mapId, color, size
      FROM map_drawings
      ORDER BY map_id, sort_order, id
    `
  )) {
    const stroke: DrawingStroke = {
      id: row.id,
      color: row.color,
      size: row.size,
      points: []
    };

    mapsById.get(row.mapId)?.drawings.push(stroke);
    drawingsById.set(stroke.id, stroke);
  }

  for (const row of readAll<{
    strokeId: string;
    x: number;
    y: number;
  }>(
    database,
    `
      SELECT stroke_id as strokeId, x, y
      FROM map_drawing_points
      ORDER BY stroke_id, sort_order
    `
  )) {
    drawingsById.get(row.strokeId)?.points.push({
      x: row.x,
      y: row.y
    });
  }

  for (const row of readAll<{
    id: string;
    campaignId: string;
    actorId: string;
    actorKind: ActorKind;
    mapId: string;
    x: number;
    y: number;
    size: number;
    color: string;
    label: string;
    visible: number;
  }>(
    database,
    `
      SELECT
        id,
        campaign_id as campaignId,
        actor_id as actorId,
        actor_kind as actorKind,
        map_id as mapId,
        x,
        y,
        size,
        color,
        label,
        visible
      FROM tokens
      ORDER BY campaign_id, sort_order, id
    `
  )) {
    campaignsById.get(row.campaignId)?.tokens.push({
      id: row.id,
      actorId: row.actorId,
      actorKind: row.actorKind,
      mapId: row.mapId,
      x: row.x,
      y: row.y,
      size: row.size,
      color: row.color,
      label: row.label,
      visible: toBoolean(row.visible)
    });
  }

  for (const row of readAll<{
    id: string;
    campaignId: string;
    userId: string;
    userName: string;
    text: string;
    createdAt: string;
    kind: ChatMessage["kind"];
  }>(
    database,
    `
      SELECT
        id,
        campaign_id as campaignId,
        user_id as userId,
        user_name as userName,
        text,
        created_at as createdAt,
        kind
      FROM chat_messages
      ORDER BY campaign_id, sort_order, id
    `
  )) {
    const message: ChatMessage = {
      id: row.id,
      campaignId: row.campaignId,
      userId: row.userId,
      userName: row.userName,
      text: row.text,
      createdAt: row.createdAt,
      kind: row.kind
    };

    campaignsById.get(row.campaignId)?.chat.push(message);
    messagesById.set(message.id, message);
  }

  for (const row of readAll<{
    id: string;
    messageId: string;
    label: string;
    notation: string;
    modifier: number;
    total: number;
    createdAt: string;
  }>(
    database,
    `
      SELECT
        id,
        message_id as messageId,
        label,
        notation,
        modifier,
        total,
        created_at as createdAt
      FROM chat_rolls
      ORDER BY message_id
    `
  )) {
    const roll: DiceRoll = {
      id: row.id,
      label: row.label,
      notation: row.notation,
      rolls: [],
      modifier: row.modifier,
      total: row.total,
      createdAt: row.createdAt
    };

    const message = messagesById.get(row.messageId);

    if (message) {
      message.roll = roll;
      rollsById.set(roll.id, roll);
    }
  }

  for (const row of readAll<{
    rollId: string;
    value: number;
  }>(
    database,
    `
      SELECT roll_id as rollId, value
      FROM chat_roll_values
      ORDER BY roll_id, sort_order
    `
  )) {
    rollsById.get(row.rollId)?.rolls.push(row.value);
  }

  for (const row of readAll<{
    campaignId: string;
    userId: string;
    mapId: string;
    columnIndex: number;
    rowIndex: number;
  }>(
    database,
    `
      SELECT
        campaign_id as campaignId,
        user_id as userId,
        map_id as mapId,
        column_index as columnIndex,
        row_index as rowIndex
      FROM exploration_cells
      ORDER BY campaign_id, user_id, map_id, column_index, row_index
    `
  )) {
    const campaign = campaignsById.get(row.campaignId);

    if (!campaign) {
      continue;
    }

    const userMap = (campaign.exploration[row.userId] ??= {});
    const cells = (userMap[row.mapId] ??= []);
    cells.push(`${row.columnIndex}:${row.rowIndex}`);
  }

  return normalizeDatabase({
    users,
    sessions,
    campaigns
  });
}

function writeRelationalDatabase(database: DatabaseSync, state: Database) {
  const normalized = normalizeDatabase(state);
  clearRelationalTables(database);

  const insertUser = database.prepare(`
    INSERT INTO users (id, name, email, password_hash, salt)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertSession = database.prepare(`
    INSERT INTO sessions (token, user_id, created_at)
    VALUES (?, ?, ?)
  `);
  const insertCampaign = database.prepare(`
    INSERT INTO campaigns (id, sort_order, name, created_at, created_by, active_map_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertCampaignMember = database.prepare(`
    INSERT INTO campaign_members (campaign_id, user_id, sort_order, name, email, role)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertCampaignInvite = database.prepare(`
    INSERT INTO campaign_invites (id, campaign_id, sort_order, code, label, role, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertActor = database.prepare(`
    INSERT INTO actors (
      id,
      campaign_id,
      sort_order,
      owner_id,
      template_id,
      name,
      kind,
      class_name,
      species,
      background,
      alignment,
      level,
      challenge_rating,
      experience,
      spellcasting_ability,
      armor_class,
      initiative,
      speed,
      proficiency_bonus,
      inspiration,
      vision_range,
      hit_points_current,
      hit_points_max,
      hit_points_temp,
      hit_dice,
      ability_str,
      ability_dex,
      ability_con,
      ability_int,
      ability_wis,
      ability_cha,
      currency_pp,
      currency_gp,
      currency_ep,
      currency_sp,
      currency_cp,
      notes,
      color
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertActorSkill = database.prepare(`
    INSERT INTO actor_skills (actor_id, id, sort_order, name, ability, proficient, expertise)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertActorSpellSlot = database.prepare(`
    INSERT INTO actor_spell_slots (actor_id, level, total, used)
    VALUES (?, ?, ?, ?)
  `);
  const insertActorTextEntry = database.prepare(`
    INSERT INTO actor_text_entries (actor_id, kind, sort_order, value)
    VALUES (?, ?, ?, ?)
  `);
  const insertActorAttack = database.prepare(`
    INSERT INTO actor_attacks (actor_id, id, sort_order, name, attack_bonus, damage, damage_type, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertActorArmorItem = database.prepare(`
    INSERT INTO actor_armor_items (actor_id, id, sort_order, name, armor_class, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertActorResource = database.prepare(`
    INSERT INTO actor_resources (actor_id, id, sort_order, name, current_value, max_value, reset_on)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertActorInventory = database.prepare(`
    INSERT INTO actor_inventory (actor_id, id, sort_order, name, quantity)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertMap = database.prepare(`
    INSERT INTO maps (
      id,
      campaign_id,
      sort_order,
      name,
      background_url,
      background_offset_x,
      background_offset_y,
      background_scale,
      width,
      height,
      grid_show,
      grid_cell_size,
      grid_scale,
      grid_offset_x,
      grid_offset_y,
      grid_color,
      visibility_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMapWall = database.prepare(`
    INSERT INTO map_walls (id, map_id, sort_order, start_x, start_y, end_x, end_y, kind, is_open)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMapDrawing = database.prepare(`
    INSERT INTO map_drawings (id, map_id, sort_order, color, size)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertMapDrawingPoint = database.prepare(`
    INSERT INTO map_drawing_points (stroke_id, sort_order, x, y)
    VALUES (?, ?, ?, ?)
  `);
  const insertToken = database.prepare(`
    INSERT INTO tokens (
      id,
      campaign_id,
      sort_order,
      actor_id,
      actor_kind,
      map_id,
      x,
      y,
      size,
      color,
      label,
      visible
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertChatMessage = database.prepare(`
    INSERT INTO chat_messages (id, campaign_id, sort_order, user_id, user_name, text, created_at, kind)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertChatRoll = database.prepare(`
    INSERT INTO chat_rolls (id, message_id, label, notation, modifier, total, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertChatRollValue = database.prepare(`
    INSERT INTO chat_roll_values (roll_id, sort_order, value)
    VALUES (?, ?, ?)
  `);
  const insertExplorationCell = database.prepare(`
    INSERT INTO exploration_cells (campaign_id, user_id, map_id, column_index, row_index)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const user of normalized.users) {
    insertUser.run(user.id, user.name, user.email, user.passwordHash, user.salt);
  }

  for (const session of normalized.sessions) {
    insertSession.run(session.token, session.userId, session.createdAt);
  }

  normalized.campaigns.forEach((campaign, campaignOrder) => {
    insertCampaign.run(
      campaign.id,
      campaignOrder,
      campaign.name,
      campaign.createdAt,
      campaign.createdBy,
      campaign.activeMapId
    );

    campaign.members.forEach((member, memberOrder) => {
      insertCampaignMember.run(
        campaign.id,
        member.userId,
        memberOrder,
        member.name,
        member.email,
        member.role
      );
    });

    campaign.invites.forEach((invite, inviteOrder) => {
      insertCampaignInvite.run(
        invite.id,
        campaign.id,
        inviteOrder,
        invite.code,
        invite.label,
        invite.role,
        invite.createdAt,
        invite.createdBy
      );
    });

    campaign.actors.forEach((actor, actorOrder) => {
      insertActor.run(
        actor.id,
        campaign.id,
        actorOrder,
        actor.ownerId ?? null,
        actor.templateId ?? null,
        actor.name,
        actor.kind,
        actor.className,
        actor.species,
        actor.background,
        actor.alignment,
        actor.level,
        actor.challengeRating,
        actor.experience,
        actor.spellcastingAbility,
        actor.armorClass,
        actor.initiative,
        actor.speed,
        actor.proficiencyBonus,
        toIntegerBoolean(actor.inspiration),
        actor.visionRange,
        actor.hitPoints.current,
        actor.hitPoints.max,
        actor.hitPoints.temp,
        actor.hitDice,
        actor.abilities.str,
        actor.abilities.dex,
        actor.abilities.con,
        actor.abilities.int,
        actor.abilities.wis,
        actor.abilities.cha,
        actor.currency.pp,
        actor.currency.gp,
        actor.currency.ep,
        actor.currency.sp,
        actor.currency.cp,
        actor.notes,
        actor.color
      );

      actor.skills.forEach((skill, skillOrder) => {
        insertActorSkill.run(
          actor.id,
          skill.id,
          skillOrder,
          skill.name,
          skill.ability,
          toIntegerBoolean(skill.proficient),
          toIntegerBoolean(skill.expertise)
        );
      });

      actor.spellSlots.forEach((slot) => {
        insertActorSpellSlot.run(actor.id, slot.level, slot.total, slot.used);
      });

      writeActorTextEntries(insertActorTextEntry, actor.id, "features", actor.features);
      writeActorTextEntries(insertActorTextEntry, actor.id, "spells", actor.spells);
      writeActorTextEntries(insertActorTextEntry, actor.id, "talents", actor.talents);
      writeActorTextEntries(insertActorTextEntry, actor.id, "feats", actor.feats);

      actor.attacks.forEach((attack, attackOrder) => {
        insertActorAttack.run(
          actor.id,
          attack.id,
          attackOrder,
          attack.name,
          attack.attackBonus,
          attack.damage,
          attack.damageType,
          attack.notes
        );
      });

      actor.armorItems.forEach((item, itemOrder) => {
        insertActorArmorItem.run(actor.id, item.id, itemOrder, item.name, item.armorClass, item.notes);
      });

      actor.resources.forEach((resource, resourceOrder) => {
        insertActorResource.run(
          actor.id,
          resource.id,
          resourceOrder,
          resource.name,
          resource.current,
          resource.max,
          resource.resetOn
        );
      });

      actor.inventory.forEach((item, itemOrder) => {
        insertActorInventory.run(actor.id, item.id, itemOrder, item.name, item.quantity);
      });
    });

    campaign.maps.forEach((map, mapOrder) => {
      insertMap.run(
        map.id,
        campaign.id,
        mapOrder,
        map.name,
        map.backgroundUrl,
        map.backgroundOffsetX,
        map.backgroundOffsetY,
        map.backgroundScale,
        map.width,
        map.height,
        toIntegerBoolean(map.grid.show),
        map.grid.cellSize,
        map.grid.scale,
        map.grid.offsetX,
        map.grid.offsetY,
        map.grid.color,
        map.visibilityVersion ?? 1
      );

      map.walls.forEach((wall, wallOrder) => {
        insertMapWall.run(
          wall.id,
          map.id,
          wallOrder,
          wall.start.x,
          wall.start.y,
          wall.end.x,
          wall.end.y,
          wall.kind ?? "wall",
          toIntegerBoolean(wall.kind === "door" ? wall.isOpen : false)
        );
      });

      map.drawings.forEach((stroke, strokeOrder) => {
        insertMapDrawing.run(stroke.id, map.id, strokeOrder, stroke.color, stroke.size);

        stroke.points.forEach((point, pointOrder) => {
          insertMapDrawingPoint.run(stroke.id, pointOrder, point.x, point.y);
        });
      });
    });

    campaign.tokens.forEach((token, tokenOrder) => {
      insertToken.run(
        token.id,
        campaign.id,
        tokenOrder,
        token.actorId,
        token.actorKind,
        token.mapId,
        token.x,
        token.y,
        token.size,
        token.color,
        token.label,
        toIntegerBoolean(token.visible)
      );
    });

    campaign.chat.forEach((message, messageOrder) => {
      insertChatMessage.run(
        message.id,
        campaign.id,
        messageOrder,
        message.userId,
        message.userName,
        message.text,
        message.createdAt,
        message.kind
      );

      if (!message.roll) {
        return;
      }

      insertChatRoll.run(
        message.roll.id,
        message.id,
        message.roll.label,
        message.roll.notation,
        message.roll.modifier,
        message.roll.total,
        message.roll.createdAt
      );

      message.roll.rolls.forEach((value, valueOrder) => {
        insertChatRollValue.run(message.roll!.id, valueOrder, value);
      });
    });

    for (const [userId, perMap] of Object.entries(campaign.exploration)) {
      for (const [mapId, cells] of Object.entries(perMap)) {
        for (const key of new Set(cells)) {
          const parsed = parseCellKey(key);

          if (!parsed) {
            continue;
          }

          insertExplorationCell.run(campaign.id, userId, mapId, parsed.column, parsed.row);
        }
      }
    }
  });
}

function clearRelationalTables(database: DatabaseSync) {
  database.exec(`
    DELETE FROM chat_roll_values;
    DELETE FROM chat_rolls;
    DELETE FROM chat_messages;
    DELETE FROM exploration_cells;
    DELETE FROM tokens;
    DELETE FROM map_drawing_points;
    DELETE FROM map_drawings;
    DELETE FROM map_walls;
    DELETE FROM maps;
    DELETE FROM actor_inventory;
    DELETE FROM actor_resources;
    DELETE FROM actor_armor_items;
    DELETE FROM actor_attacks;
    DELETE FROM actor_text_entries;
    DELETE FROM actor_spell_slots;
    DELETE FROM actor_skills;
    DELETE FROM actors;
    DELETE FROM campaign_invites;
    DELETE FROM campaign_members;
    DELETE FROM campaigns;
    DELETE FROM sessions;
    DELETE FROM users;
  `);
}

function readAll<T>(database: DatabaseSync, sql: string, ...params: SQLInputValue[]) {
  return database.prepare(sql).all(...params) as T[];
}

function writeActorTextEntries(
  statement: ReturnType<DatabaseSync["prepare"]>,
  actorId: string,
  kind: "features" | "spells" | "talents" | "feats",
  values: string[]
) {
  values.forEach((value, index) => {
    statement.run(actorId, kind, index, value);
  });
}

function parseCellKey(key: string) {
  const [columnText, rowText] = key.split(":");
  const column = Number(columnText);
  const row = Number(rowText);

  if (!Number.isInteger(column) || !Number.isInteger(row)) {
    return null;
  }

  return { column, row };
}

function toBoolean(value: number) {
  return value === 1;
}

function toIntegerBoolean(value: boolean) {
  return value ? 1 : 0;
}
