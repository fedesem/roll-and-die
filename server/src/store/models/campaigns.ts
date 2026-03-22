import type { DatabaseSync } from "node:sqlite";

import type {
  AbilityKey,
  ActorBonusEntry,
  ActorClassEntry,
  ActorKind,
  ActorLayoutEntry,
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
  MapTeleporter,
  MapWall,
  ResourceEntry,
  SkillEntry,
  SpellSlotTrack
} from "../../../../shared/types.js";
import type { Database } from "../types.js";
import { normalizeStoreState } from "../normalization.js";
import { parseCellKey, readAll, toBoolean, toIntegerBoolean } from "../helpers.js";

export function readCampaigns(database: DatabaseSync): Campaign[] {
  const campaigns = readAll<{
    id: string;
    name: string;
    createdAt: string;
    createdBy: string;
    activeMapId: string;
    allowedSourceBooksJson: string;
  }>(
    database,
    `
      SELECT id, name, created_at as createdAt, created_by as createdBy, active_map_id as activeMapId, allowed_source_books_json as allowedSourceBooksJson
      FROM campaigns
      ORDER BY sort_order, created_at, id
    `
  ).map<Campaign>((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    activeMapId: row.activeMapId,
    allowedSourceBooks: parseJsonArray<string>(row.allowedSourceBooksJson),
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
    imageUrl: string;
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
    preparedSpellsJson: string;
    layoutJson: string;
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
        image_url as imageUrl,
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
        color,
        prepared_spells_json as preparedSpellsJson,
        layout_json as layoutJson
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
      imageUrl: row.imageUrl,
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
      classes: [],
      spellSlots: [],
      features: [],
      spells: [],
      preparedSpells: parseJsonArray<string>(row.preparedSpellsJson),
      talents: [],
      feats: [],
      bonuses: [],
      layout: parseJsonArray<ActorLayoutEntry>(row.layoutJson),
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
    compendiumId: string;
    name: string;
    source: string;
    level: number;
    hitDieFaces: number;
    usedHitDice: number;
    spellcastingAbility: AbilityKey | null;
  }>(
    database,
    `
      SELECT
        actor_id as actorId,
        id,
        compendium_id as compendiumId,
        name,
        source,
        level,
        hit_die_faces as hitDieFaces,
        used_hit_dice as usedHitDice,
        spellcasting_ability as spellcastingAbility
      FROM actor_classes
      ORDER BY actor_id, sort_order, id
    `
  )) {
    actorsById.get(row.actorId)?.classes.push({
      id: row.id,
      compendiumId: row.compendiumId,
      name: row.name,
      source: row.source,
      level: row.level,
      hitDieFaces: row.hitDieFaces,
      usedHitDice: row.usedHitDice,
      spellcastingAbility: row.spellcastingAbility
    } satisfies ActorClassEntry);
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

  for (const row of readAll<{
    actorId: string;
    id: string;
    name: string;
    kind: ArmorEntry["kind"];
    armorClass: number;
    maxDexBonus: number | null;
    bonus: number;
    equipped: number;
    notes: string;
  }>(
    database,
    `
      SELECT
        actor_id as actorId,
        id,
        name,
        kind,
        armor_class as armorClass,
        max_dex_bonus as maxDexBonus,
        bonus,
        equipped,
        notes
      FROM actor_armor_items
      ORDER BY actor_id, sort_order, id
    `
  )) {
    actorsById.get(row.actorId)?.armorItems.push({
      id: row.id,
      name: row.name,
      kind: row.kind,
      armorClass: row.armorClass,
      maxDexBonus: row.maxDexBonus,
      bonus: row.bonus,
      equipped: toBoolean(row.equipped),
      notes: row.notes
    } satisfies ArmorEntry);
  }

  for (const row of readAll<{
    actorId: string;
    id: string;
    name: string;
    sourceType: ActorBonusEntry["sourceType"];
    targetType: ActorBonusEntry["targetType"];
    targetKey: string;
    value: number;
    enabled: number;
  }>(
    database,
    `
      SELECT
        actor_id as actorId,
        id,
        name,
        source_type as sourceType,
        target_type as targetType,
        target_key as targetKey,
        value,
        enabled
      FROM actor_bonuses
      ORDER BY actor_id, sort_order, id
    `
  )) {
    actorsById.get(row.actorId)?.bonuses.push({
      id: row.id,
      name: row.name,
      sourceType: row.sourceType,
      targetType: row.targetType,
      targetKey: row.targetKey,
      value: row.value,
      enabled: toBoolean(row.enabled)
    } satisfies ActorBonusEntry);
  }

  for (const row of readAll<{
    actorId: string;
    id: string;
    name: string;
    current: number;
    max: number;
    resetOn: string;
    restoreAmount: number;
  }>(
    database,
    `
      SELECT
        actor_id as actorId,
        id,
        name,
        current_value as current,
        max_value as max,
        reset_on as resetOn,
        restore_amount as restoreAmount
      FROM actor_resources
      ORDER BY actor_id, sort_order, id
    `
  )) {
    actorsById.get(row.actorId)?.resources.push({
      id: row.id,
      name: row.name,
      current: row.current,
      max: row.max,
      resetOn: row.resetOn,
      restoreAmount: row.restoreAmount
    } satisfies ResourceEntry);
  }

  for (const row of readAll<{
    actorId: string;
    id: string;
    name: string;
    itemType: InventoryEntry["type"];
    quantity: number;
    equipped: number;
    notes: string;
  }>(
    database,
    `
      SELECT
        actor_id as actorId,
        id,
        name,
        item_type as itemType,
        quantity,
        equipped,
        notes
      FROM actor_inventory
      ORDER BY actor_id, sort_order, id
    `
  )) {
    actorsById.get(row.actorId)?.inventory.push({
      id: row.id,
      name: row.name,
      type: row.itemType,
      quantity: row.quantity,
      equipped: toBoolean(row.equipped),
      notes: row.notes
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
      teleporters: [],
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
    pairNumber: number;
    pointAX: number;
    pointAY: number;
    pointBX: number;
    pointBY: number;
  }>(
    database,
    `
      SELECT
        id,
        map_id as mapId,
        pair_number as pairNumber,
        point_a_x as pointAX,
        point_a_y as pointAY,
        point_b_x as pointBX,
        point_b_y as pointBY
      FROM map_teleporters
      ORDER BY map_id, sort_order, id
    `
  )) {
    mapsById.get(row.mapId)?.teleporters.push({
      id: row.id,
      pairNumber: row.pairNumber,
      pointA: { x: row.pointAX, y: row.pointAY },
      pointB: { x: row.pointBX, y: row.pointBY }
    } satisfies MapTeleporter);
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

  for (const row of readAll<{ id: string; campaignId: string; actorId: string; actorKind: ActorKind; mapId: string; x: number; y: number; size: number; color: string; label: string; imageUrl: string; visible: number }>(
    database,
    `
      SELECT id, campaign_id as campaignId, actor_id as actorId, actor_kind as actorKind, map_id as mapId, x, y, size, color, label, image_url as imageUrl, visible
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
      imageUrl: row.imageUrl,
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
    actorId: string | null;
    actorName: string | null;
    actorImageUrl: string | null;
    actorColor: string | null;
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
        kind,
        actor_id as actorId,
        actor_name as actorName,
        actor_image_url as actorImageUrl,
        actor_color as actorColor
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
      kind: row.kind,
      actor:
        row.actorId && row.actorName && row.actorImageUrl !== null && row.actorColor
          ? {
              actorId: row.actorId,
              actorName: row.actorName,
              actorImageUrl: row.actorImageUrl,
              actorColor: row.actorColor
            }
          : undefined
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
    breakdown: string | null;
    createdAt: string;
  }>(
    database,
    `
      SELECT id, message_id as messageId, label, notation, modifier, total, breakdown, created_at as createdAt
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
      breakdown: row.breakdown ?? undefined,
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

  return normalizeStoreState({
    users: [],
    sessions: [],
    campaigns,
    compendium: {
      spells: [],
      monsters: [],
      feats: [],
      classes: [],
      actions: [],
      backgrounds: [],
      items: [],
      languages: [],
      races: [],
      skills: []
    }
  }).campaigns;
}

export function readRealtimeCampaign(database: DatabaseSync, campaignId: string): Campaign | null {
  const campaignRow = database
    .prepare(
      `
        SELECT
          id,
          name,
          created_at as createdAt,
          created_by as createdBy,
          active_map_id as activeMapId,
          allowed_source_books_json as allowedSourceBooksJson
        FROM campaigns
        WHERE id = ?
        LIMIT 1
      `
    )
    .get(campaignId) as
    | {
        id: string;
        name: string;
        createdAt: string;
        createdBy: string;
        activeMapId: string;
        allowedSourceBooksJson: string;
      }
    | undefined;

  if (!campaignRow) {
    return null;
  }

  const campaign: Campaign = {
    id: campaignRow.id,
    name: campaignRow.name,
    createdAt: campaignRow.createdAt,
    createdBy: campaignRow.createdBy,
    activeMapId: campaignRow.activeMapId,
    allowedSourceBooks: parseJsonArray<string>(campaignRow.allowedSourceBooksJson),
    members: [],
    invites: [],
    actors: [],
    maps: [],
    mapAssignments: [],
    tokens: [],
    chat: [],
    exploration: {}
  };

  campaign.members = readAll<{
    userId: string;
    name: string;
    email: string;
    role: CampaignMember["role"];
  }>(
    database,
    `
      SELECT user_id as userId, name, email, role
      FROM campaign_members
      WHERE campaign_id = ?
      ORDER BY sort_order, user_id
    `,
    campaignId
  ).map((row) => ({
    userId: row.userId,
    name: row.name,
    email: row.email,
    role: row.role
  }));

  campaign.actors = readAll<{
    id: string;
    ownerId: string | null;
    name: string;
    kind: ActorKind;
    imageUrl: string;
    visionRange: number;
    color: string;
  }>(
    database,
    `
      SELECT
        id,
        owner_id as ownerId,
        name,
        kind,
        image_url as imageUrl,
        vision_range as visionRange,
        color
      FROM actors
      WHERE campaign_id = ?
      ORDER BY sort_order, id
    `,
    campaignId
  ).map((row) => createRealtimeActorShell(campaignId, row));

  const activeMap = database
    .prepare(
      `
        SELECT
          id,
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
        WHERE id = ?
        LIMIT 1
      `
    )
    .get(campaign.activeMapId) as
    | {
        id: string;
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
      }
    | undefined;

  if (!activeMap) {
    return campaign;
  }

  const map: CampaignMap = {
    id: activeMap.id,
    name: activeMap.name,
    backgroundUrl: activeMap.backgroundUrl,
    backgroundOffsetX: activeMap.backgroundOffsetX,
    backgroundOffsetY: activeMap.backgroundOffsetY,
    backgroundScale: activeMap.backgroundScale,
    width: activeMap.width,
    height: activeMap.height,
    grid: {
      show: toBoolean(activeMap.gridShow),
      cellSize: activeMap.gridCellSize,
      scale: activeMap.gridScale,
      offsetX: activeMap.gridOffsetX,
      offsetY: activeMap.gridOffsetY,
      color: activeMap.gridColor
    },
    walls: [],
    teleporters: [],
    drawings: [],
    fog: [],
    visibilityVersion: activeMap.visibilityVersion ?? 1
  };

  map.walls = readAll<{
    id: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    kind: MapWall["kind"];
    isOpen: number;
  }>(
    database,
    `
      SELECT id, start_x as startX, start_y as startY, end_x as endX, end_y as endY, kind, is_open as isOpen
      FROM map_walls
      WHERE map_id = ?
      ORDER BY sort_order, id
    `,
    map.id
  ).map((row) => ({
    id: row.id,
    start: { x: row.startX, y: row.startY },
    end: { x: row.endX, y: row.endY },
    kind: row.kind ?? "wall",
    isOpen: toBoolean(row.isOpen)
  }));

  map.teleporters = readAll<{
    id: string;
    pairNumber: number;
    pointAX: number;
    pointAY: number;
    pointBX: number;
    pointBY: number;
  }>(
    database,
    `
      SELECT
        id,
        pair_number as pairNumber,
        point_a_x as pointAX,
        point_a_y as pointAY,
        point_b_x as pointBX,
        point_b_y as pointBY
      FROM map_teleporters
      WHERE map_id = ?
      ORDER BY sort_order, id
    `,
    map.id
  ).map((row) => ({
    id: row.id,
    pairNumber: row.pairNumber,
    pointA: { x: row.pointAX, y: row.pointAY },
    pointB: { x: row.pointBX, y: row.pointBY }
  }));

  campaign.maps = [map];
  campaign.mapAssignments = readAll<{ mapId: string; actorId: string }>(
    database,
    `
      SELECT map_id as mapId, actor_id as actorId
      FROM map_actor_assignments
      WHERE campaign_id = ? AND map_id = ?
      ORDER BY actor_id
    `,
    campaignId,
    map.id
  );

  campaign.tokens = readAll<{
    id: string;
    actorId: string;
    actorKind: ActorKind;
    mapId: string;
    x: number;
    y: number;
    size: number;
    color: string;
    label: string;
    imageUrl: string;
    visible: number;
  }>(
    database,
    `
      SELECT
        id,
        actor_id as actorId,
        actor_kind as actorKind,
        map_id as mapId,
        x,
        y,
        size,
        color,
        label,
        image_url as imageUrl,
        visible
      FROM tokens
      WHERE campaign_id = ? AND map_id = ?
      ORDER BY sort_order, id
    `,
    campaignId,
    map.id
  ).map((row) => ({
    id: row.id,
    actorId: row.actorId,
    actorKind: row.actorKind,
    mapId: row.mapId,
    x: row.x,
    y: row.y,
    size: row.size,
    color: row.color,
    label: row.label,
    imageUrl: row.imageUrl,
    visible: toBoolean(row.visible)
  }));

  for (const row of readAll<{ userId: string; columnIndex: number; rowIndex: number }>(
    database,
    `
      SELECT user_id as userId, column_index as columnIndex, row_index as rowIndex
      FROM exploration_cells
      WHERE campaign_id = ? AND map_id = ?
      ORDER BY user_id, column_index, row_index
    `,
    campaignId,
    map.id
  )) {
    const userMap = (campaign.exploration[row.userId] ??= {});
    const cells = (userMap[map.id] ??= []);
    cells.push(`${row.columnIndex}:${row.rowIndex}`);
  }

  return campaign;
}

export function upsertCampaignToken(database: DatabaseSync, campaignId: string, token: Campaign["tokens"][number]) {
  database
    .prepare(
      `
        INSERT INTO tokens (
          id, campaign_id, sort_order, actor_id, actor_kind, map_id, x, y, size, color, label, image_url, visible
        )
        VALUES (
          ?, ?, COALESCE((SELECT MAX(sort_order) + 1 FROM tokens WHERE campaign_id = ?), 0), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
        ON CONFLICT(id) DO UPDATE SET
          actor_id = excluded.actor_id,
          actor_kind = excluded.actor_kind,
          map_id = excluded.map_id,
          x = excluded.x,
          y = excluded.y,
          size = excluded.size,
          color = excluded.color,
          label = excluded.label,
          image_url = excluded.image_url,
          visible = excluded.visible
      `
    )
    .run(
      token.id,
      campaignId,
      campaignId,
      token.actorId,
      token.actorKind,
      token.mapId,
      token.x,
      token.y,
      token.size,
      token.color,
      token.label,
      token.imageUrl,
      toIntegerBoolean(token.visible)
    );
}

export function updateCampaignDoorState(database: DatabaseSync, doorId: string, isOpen: boolean) {
  database
    .prepare(
      `
        UPDATE map_walls
        SET is_open = ?
        WHERE id = ? AND kind = 'door'
      `
    )
    .run(toIntegerBoolean(isOpen), doorId);
}

export function insertCampaignExplorationCells(
  database: DatabaseSync,
  campaignId: string,
  userId: string,
  mapId: string,
  cells: string[]
) {
  const insertCell = database.prepare(`
    INSERT OR IGNORE INTO exploration_cells (campaign_id, user_id, map_id, column_index, row_index)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const key of new Set(cells)) {
    const parsed = parseCellKey(key);

    if (!parsed) {
      continue;
    }

    insertCell.run(campaignId, userId, mapId, parsed.column, parsed.row);
  }
}

export function writeCampaigns(database: DatabaseSync, state: Database) {
  const normalized = normalizeStoreState(state);

  const insertCampaign = database.prepare(`
    INSERT INTO campaigns (id, sort_order, name, created_at, created_by, active_map_id, allowed_source_books_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
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
      id, campaign_id, sort_order, owner_id, template_id, name, kind, image_url, class_name, species, background, alignment, level,
      challenge_rating, experience, spellcasting_ability, armor_class, initiative, speed, proficiency_bonus, inspiration,
      vision_range, hit_points_current, hit_points_max, hit_points_temp, hit_dice, ability_str, ability_dex, ability_con,
      ability_int, ability_wis, ability_cha, currency_pp, currency_gp, currency_ep, currency_sp, currency_cp, notes, color,
      prepared_spells_json, layout_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertActorClass = database.prepare(`
    INSERT INTO actor_classes (actor_id, id, sort_order, compendium_id, name, source, level, hit_die_faces, used_hit_dice, spellcasting_ability)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    INSERT INTO actor_armor_items (actor_id, id, sort_order, name, kind, armor_class, max_dex_bonus, bonus, equipped, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertActorBonus = database.prepare(`
    INSERT INTO actor_bonuses (actor_id, id, sort_order, name, source_type, target_type, target_key, value, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertActorResource = database.prepare(`
    INSERT INTO actor_resources (actor_id, id, sort_order, name, current_value, max_value, reset_on, restore_amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertActorInventory = database.prepare(`
    INSERT INTO actor_inventory (actor_id, id, sort_order, name, item_type, quantity, equipped, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
  const insertMapTeleporter = database.prepare(`
    INSERT INTO map_teleporters (id, map_id, sort_order, pair_number, point_a_x, point_a_y, point_b_x, point_b_y)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
    INSERT INTO tokens (id, campaign_id, sort_order, actor_id, actor_kind, map_id, x, y, size, color, label, image_url, visible)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertChatMessage = database.prepare(`
    INSERT INTO chat_messages (
      id, campaign_id, sort_order, user_id, user_name, text, created_at, kind,
      actor_id, actor_name, actor_image_url, actor_color
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertChatRoll = database.prepare(`
    INSERT INTO chat_rolls (id, message_id, label, notation, modifier, total, breakdown, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
    insertCampaign.run(
      campaign.id,
      campaignOrder,
      campaign.name,
      campaign.createdAt,
      campaign.createdBy,
      campaign.activeMapId,
      JSON.stringify(campaign.allowedSourceBooks)
    );

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
        actor.imageUrl,
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
        actor.color,
        JSON.stringify(actor.preparedSpells),
        JSON.stringify(actor.layout)
      );

      actor.classes.forEach((actorClass, classOrder) => {
        insertActorClass.run(
          actor.id,
          actorClass.id,
          classOrder,
          actorClass.compendiumId,
          actorClass.name,
          actorClass.source,
          actorClass.level,
          actorClass.hitDieFaces,
          actorClass.usedHitDice,
          actorClass.spellcastingAbility
        );
      });

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
        insertActorArmorItem.run(
          actor.id,
          item.id,
          itemOrder,
          item.name,
          item.kind,
          item.armorClass,
          item.maxDexBonus,
          item.bonus,
          toIntegerBoolean(item.equipped),
          item.notes
        );
      });

      actor.bonuses.forEach((bonus, bonusOrder) => {
        insertActorBonus.run(
          actor.id,
          bonus.id,
          bonusOrder,
          bonus.name,
          bonus.sourceType,
          bonus.targetType,
          bonus.targetKey,
          bonus.value,
          toIntegerBoolean(bonus.enabled)
        );
      });

      actor.resources.forEach((resource, resourceOrder) => {
        insertActorResource.run(
          actor.id,
          resource.id,
          resourceOrder,
          resource.name,
          resource.current,
          resource.max,
          resource.resetOn,
          resource.restoreAmount
        );
      });

      actor.inventory.forEach((item, itemOrder) => {
        insertActorInventory.run(
          actor.id,
          item.id,
          itemOrder,
          item.name,
          item.type,
          item.quantity,
          toIntegerBoolean(item.equipped),
          item.notes
        );
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

      map.teleporters.forEach((teleporter, teleporterOrder) => {
        insertMapTeleporter.run(
          teleporter.id,
          map.id,
          teleporterOrder,
          teleporter.pairNumber,
          teleporter.pointA.x,
          teleporter.pointA.y,
          teleporter.pointB.x,
          teleporter.pointB.y
        );
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
      insertToken.run(token.id, campaign.id, tokenOrder, token.actorId, token.actorKind, token.mapId, token.x, token.y, token.size, token.color, token.label, token.imageUrl, toIntegerBoolean(token.visible));
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
        message.kind,
        message.actor?.actorId ?? null,
        message.actor?.actorName ?? null,
        message.actor?.actorImageUrl ?? null,
        message.actor?.actorColor ?? null
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
        message.roll.breakdown ?? null,
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
    DELETE FROM map_teleporters;
    DELETE FROM map_walls;
    DELETE FROM maps;
    DELETE FROM actor_inventory;
    DELETE FROM actor_resources;
    DELETE FROM actor_bonuses;
    DELETE FROM actor_armor_items;
    DELETE FROM actor_attacks;
    DELETE FROM actor_text_entries;
    DELETE FROM actor_spell_slots;
    DELETE FROM actor_skills;
    DELETE FROM actor_classes;
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

function createRealtimeActorShell(
  campaignId: string,
  row: {
    id: string;
    ownerId: string | null;
    name: string;
    kind: ActorKind;
    imageUrl: string;
    visionRange: number;
    color: string;
  }
): ActorSheet {
  return {
    id: row.id,
    campaignId,
    ownerId: row.ownerId ?? undefined,
    name: row.name,
    kind: row.kind,
    imageUrl: row.imageUrl,
    className: "",
    species: "",
    background: "",
    alignment: "",
    level: 1,
    challengeRating: "",
    experience: 0,
    spellcastingAbility: "wis",
    armorClass: 10,
    initiative: 0,
    speed: 30,
    proficiencyBonus: 2,
    inspiration: false,
    visionRange: row.visionRange,
    hitPoints: {
      current: 1,
      max: 1,
      temp: 0
    },
    hitDice: "",
    abilities: {
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10
    },
    skills: [],
    classes: [],
    spellSlots: [],
    features: [],
    spells: [],
    preparedSpells: [],
    talents: [],
    feats: [],
    bonuses: [],
    layout: [],
    attacks: [],
    armorItems: [],
    resources: [],
    inventory: [],
    currency: {
      pp: 0,
      gp: 0,
      ep: 0,
      sp: 0,
      cp: 0
    },
    notes: "",
    color: row.color
  };
}

function parseJsonArray<T>(raw: string) {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}
