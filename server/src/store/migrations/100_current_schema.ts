import type { Migration } from "../types.js";

export const currentSchemaMigration: Migration = {
  version: 100,
  name: "current_schema",
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
        kind TEXT NOT NULL CHECK (kind IN ('character', 'npc', 'monster', 'static')),
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
        owner_id TEXT,
        kind TEXT NOT NULL DEFAULT 'freehand' CHECK (kind IN ('freehand', 'circle', 'square', 'star')),
        color TEXT NOT NULL,
        stroke_opacity REAL NOT NULL DEFAULT 1,
        fill_color TEXT NOT NULL DEFAULT '',
        fill_opacity REAL NOT NULL DEFAULT 0.22,
        size REAL NOT NULL,
        rotation REAL NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS map_drawing_points (
        stroke_id TEXT NOT NULL REFERENCES map_drawings(id) ON DELETE CASCADE,
        sort_order INTEGER NOT NULL,
        x REAL NOT NULL,
        y REAL NOT NULL,
        PRIMARY KEY (stroke_id, sort_order)
      );

      CREATE TABLE IF NOT EXISTS map_actor_assignments (
        campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        map_id TEXT NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
        actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
        PRIMARY KEY (campaign_id, map_id, actor_id)
      );

      CREATE TABLE IF NOT EXISTS tokens (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        sort_order INTEGER NOT NULL,
        actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
        actor_kind TEXT NOT NULL CHECK (actor_kind IN ('character', 'npc', 'monster', 'static')),
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
};
