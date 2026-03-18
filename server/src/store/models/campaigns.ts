import type { DatabaseSync } from "node:sqlite";

import type {
  AbilityKey,
  ActorKind,
  ActorSheet,
  ArmorEntry,
  AttackEntry,
  Campaign,
  CampaignInvite,
  CampaignMap,
  MapActorAssignment,
  CampaignMember,
  ChatMessage,
  DiceRoll,
  DrawingKind,
  DrawingStroke,
  InventoryEntry,
  MapWall,
  ResourceEntry,
  SkillEntry,
  SpellSlotTrack
} from "../../../../shared/types.js";
import type { Database } from "../types.js";
import { normalizeDatabase } from "../legacy.js";
import { parseCellKey, readAll, toBoolean, toIntegerBoolean } from "../helpers.js";

export function readCampaigns(database: DatabaseSync): Campaign[] {
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
    mapAssignments: [],
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
    role: CampaignMember["role"];
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
    role: CampaignInvite["role"];
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

  for (const row of readAll<{ actorId: string; id: string; name: string; ability: AbilityKey; proficient: number; expertise: number }>(
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

  for (const row of readAll<{ actorId: string; level: number; total: number; used: number }>(
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

  for (const row of readAll<{ actorId: string; kind: "features" | "spells" | "talents" | "feats"; value: string }>(
    database,
    `
      SELECT actor_id as actorId, kind, value
      FROM actor_text_entries
      ORDER BY actor_id, kind, sort_order
    `
  )) {
    const actor = actorsById.get(row.actorId);

    if (actor) {
      actor[row.kind].push(row.value);
    }
  }

  for (const row of readAll<{ actorId: string; id: string; name: string; attackBonus: number; damage: string; damageType: string; notes: string }>(
    database,
    `
      SELECT actor_id as actorId, id, name, attack_bonus as attackBonus, damage, damage_type as damageType, notes
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

  for (const row of readAll<{ actorId: string; id: string; name: string; armorClass: number; notes: string }>(
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

  for (const row of readAll<{ actorId: string; id: string; name: string; current: number; max: number; resetOn: string }>(
    database,
    `
      SELECT actor_id as actorId, id, name, current_value as current, max_value as max, reset_on as resetOn
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

  for (const row of readAll<{ actorId: string; id: string; name: string; quantity: number }>(
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

  for (const row of readAll<{ id: string; mapId: string; startX: number; startY: number; endX: number; endY: number; kind: "wall" | "transparent" | "door"; isOpen: number }>(
    database,
    `
      SELECT id, map_id as mapId, start_x as startX, start_y as startY, end_x as endX, end_y as endY, kind, is_open as isOpen
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
    ownerId: string | null;
    kind: DrawingKind;
    color: string;
    strokeOpacity: number;
    fillColor: string;
    fillOpacity: number;
    size: number;
    rotation: number;
  }>(
    database,
    `
      SELECT
        id,
        map_id as mapId,
        owner_id as ownerId,
        kind,
        color,
        stroke_opacity as strokeOpacity,
        fill_color as fillColor,
        fill_opacity as fillOpacity,
        size,
        rotation
      FROM map_drawings
      ORDER BY map_id, sort_order, id
    `
  )) {
    const stroke: DrawingStroke = {
      id: row.id,
      ownerId: row.ownerId ?? undefined,
      kind: row.kind ?? "freehand",
      color: row.color,
      strokeOpacity: row.strokeOpacity ?? 1,
      fillColor: row.fillColor ?? "",
      fillOpacity: row.fillOpacity ?? 0.22,
      size: row.size,
      rotation: row.rotation ?? 0,
      points: []
    };
    mapsById.get(row.mapId)?.drawings.push(stroke);
    drawingsById.set(stroke.id, stroke);
  }

  for (const row of readAll<{ strokeId: string; x: number; y: number }>(
    database,
    `
      SELECT stroke_id as strokeId, x, y
      FROM map_drawing_points
      ORDER BY stroke_id, sort_order
    `
  )) {
    drawingsById.get(row.strokeId)?.points.push({ x: row.x, y: row.y });
  }

  for (const row of readAll<{ campaignId: string; mapId: string; actorId: string }>(
    database,
    `
      SELECT campaign_id as campaignId, map_id as mapId, actor_id as actorId
      FROM map_actor_assignments
      ORDER BY campaign_id, map_id, actor_id
    `
  )) {
    campaignsById.get(row.campaignId)?.mapAssignments.push({
      mapId: row.mapId,
      actorId: row.actorId
    } satisfies MapActorAssignment);
  }

  for (const row of readAll<{ id: string; campaignId: string; actorId: string; actorKind: ActorKind; mapId: string; x: number; y: number; size: number; color: string; label: string; visible: number }>(
    database,
    `
      SELECT id, campaign_id as campaignId, actor_id as actorId, actor_kind as actorKind, map_id as mapId, x, y, size, color, label, visible
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

  for (const row of readAll<{ id: string; campaignId: string; userId: string; userName: string; text: string; createdAt: string; kind: ChatMessage["kind"] }>(
    database,
    `
      SELECT id, campaign_id as campaignId, user_id as userId, user_name as userName, text, created_at as createdAt, kind
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

  for (const row of readAll<{ id: string; messageId: string; label: string; notation: string; modifier: number; total: number; createdAt: string }>(
    database,
    `
      SELECT id, message_id as messageId, label, notation, modifier, total, created_at as createdAt
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

  for (const row of readAll<{ rollId: string; value: number }>(
    database,
    `
      SELECT roll_id as rollId, value
      FROM chat_roll_values
      ORDER BY roll_id, sort_order
    `
  )) {
    rollsById.get(row.rollId)?.rolls.push(row.value);
  }

  for (const row of readAll<{ campaignId: string; userId: string; mapId: string; columnIndex: number; rowIndex: number }>(
    database,
    `
      SELECT campaign_id as campaignId, user_id as userId, map_id as mapId, column_index as columnIndex, row_index as rowIndex
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
    users: [],
    sessions: [],
    campaigns,
    compendium: {
      spells: [],
      monsters: [],
      feats: [],
      classes: []
    }
  }).campaigns;
}

export function writeCampaigns(database: DatabaseSync, state: Database) {
  const normalized = normalizeDatabase(state);

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
      id, campaign_id, sort_order, owner_id, template_id, name, kind, class_name, species, background, alignment, level,
      challenge_rating, experience, spellcasting_ability, armor_class, initiative, speed, proficiency_bonus, inspiration,
      vision_range, hit_points_current, hit_points_max, hit_points_temp, hit_dice, ability_str, ability_dex, ability_con,
      ability_int, ability_wis, ability_cha, currency_pp, currency_gp, currency_ep, currency_sp, currency_cp, notes, color
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
      id, campaign_id, sort_order, name, background_url, background_offset_x, background_offset_y, background_scale,
      width, height, grid_show, grid_cell_size, grid_scale, grid_offset_x, grid_offset_y, grid_color, visibility_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMapWall = database.prepare(`
    INSERT INTO map_walls (id, map_id, sort_order, start_x, start_y, end_x, end_y, kind, is_open)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMapDrawing = database.prepare(`
    INSERT INTO map_drawings (id, map_id, sort_order, owner_id, kind, color, stroke_opacity, fill_color, fill_opacity, size, rotation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMapDrawingPoint = database.prepare(`
    INSERT INTO map_drawing_points (stroke_id, sort_order, x, y)
    VALUES (?, ?, ?, ?)
  `);
  const insertMapActorAssignment = database.prepare(`
    INSERT INTO map_actor_assignments (campaign_id, map_id, actor_id)
    VALUES (?, ?, ?)
  `);
  const insertToken = database.prepare(`
    INSERT INTO tokens (id, campaign_id, sort_order, actor_id, actor_kind, map_id, x, y, size, color, label, visible)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

  normalized.campaigns.forEach((campaign, campaignOrder) => {
    insertCampaign.run(campaign.id, campaignOrder, campaign.name, campaign.createdAt, campaign.createdBy, campaign.activeMapId);

    campaign.members.forEach((member, memberOrder) => {
      insertCampaignMember.run(campaign.id, member.userId, memberOrder, member.name, member.email, member.role);
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
        insertActorSkill.run(actor.id, skill.id, skillOrder, skill.name, skill.ability, toIntegerBoolean(skill.proficient), toIntegerBoolean(skill.expertise));
      });

      actor.spellSlots.forEach((slot) => {
        insertActorSpellSlot.run(actor.id, slot.level, slot.total, slot.used);
      });

      writeActorTextEntries(insertActorTextEntry, actor.id, "features", actor.features);
      writeActorTextEntries(insertActorTextEntry, actor.id, "spells", actor.spells);
      writeActorTextEntries(insertActorTextEntry, actor.id, "talents", actor.talents);
      writeActorTextEntries(insertActorTextEntry, actor.id, "feats", actor.feats);

      actor.attacks.forEach((attack, attackOrder) => {
        insertActorAttack.run(actor.id, attack.id, attackOrder, attack.name, attack.attackBonus, attack.damage, attack.damageType, attack.notes);
      });

      actor.armorItems.forEach((item, itemOrder) => {
        insertActorArmorItem.run(actor.id, item.id, itemOrder, item.name, item.armorClass, item.notes);
      });

      actor.resources.forEach((resource, resourceOrder) => {
        insertActorResource.run(actor.id, resource.id, resourceOrder, resource.name, resource.current, resource.max, resource.resetOn);
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
        insertMapWall.run(wall.id, map.id, wallOrder, wall.start.x, wall.start.y, wall.end.x, wall.end.y, wall.kind ?? "wall", toIntegerBoolean(wall.kind === "door" ? wall.isOpen : false));
      });

      map.drawings.forEach((stroke, strokeOrder) => {
        insertMapDrawing.run(
          stroke.id,
          map.id,
          strokeOrder,
          stroke.ownerId ?? null,
          stroke.kind ?? "freehand",
          stroke.color,
          stroke.strokeOpacity ?? 1,
          stroke.fillColor ?? "",
          stroke.fillOpacity ?? 0.22,
          stroke.size,
          stroke.rotation ?? 0
        );
        stroke.points.forEach((point, pointOrder) => {
          insertMapDrawingPoint.run(stroke.id, pointOrder, point.x, point.y);
        });
      });
    });

    campaign.mapAssignments.forEach((assignment) => {
      insertMapActorAssignment.run(campaign.id, assignment.mapId, assignment.actorId);
    });

    campaign.tokens.forEach((token, tokenOrder) => {
      insertToken.run(token.id, campaign.id, tokenOrder, token.actorId, token.actorKind, token.mapId, token.x, token.y, token.size, token.color, token.label, toIntegerBoolean(token.visible));
    });

    campaign.chat.forEach((message, messageOrder) => {
      insertChatMessage.run(message.id, campaign.id, messageOrder, message.userId, message.userName, message.text, message.createdAt, message.kind);

      if (!message.roll) {
        return;
      }

      insertChatRoll.run(message.roll.id, message.id, message.roll.label, message.roll.notation, message.roll.modifier, message.roll.total, message.roll.createdAt);
      message.roll.rolls.forEach((value, valueOrder) => {
        insertChatRollValue.run(message.roll!.id, valueOrder, value);
      });
    });

    for (const [userId, perMap] of Object.entries(campaign.exploration)) {
      for (const [mapId, cells] of Object.entries(perMap)) {
        for (const key of new Set(cells)) {
          const parsed = parseCellKey(key);
          if (parsed) {
            insertExplorationCell.run(campaign.id, userId, mapId, parsed.column, parsed.row);
          }
        }
      }
    }
  });
}

export function clearRelationalTables(database: DatabaseSync) {
  database.exec(`
    DELETE FROM chat_roll_values;
    DELETE FROM chat_rolls;
    DELETE FROM chat_messages;
    DELETE FROM exploration_cells;
    DELETE FROM map_actor_assignments;
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
