import type { DatabaseSync } from "../types.js";
import { TOKEN_STATUS_MARKERS } from "../../../../shared/types.js";
import type {
  AbilityKey,
  ActorBonusEntry,
  ActorClassEntry,
  ActorKind,
  ActorLayoutEntry,
  ActorSheet,
  ArmorEntry,
  AttackEntry,
  BoardToken,
  Campaign,
  CampaignInvite,
  CampaignMap,
  MapActorAssignment,
  CampaignMember,
  CampaignSummary,
  ChatActorContext,
  ChatMessage,
  DiceRoll,
  DrawingKind,
  DrawingStroke,
  DrawingTextFont,
  InventoryEntry,
  MapTeleporter,
  MapWall,
  Point,
  PlayerNpcBuild,
  ResourceEntry,
  SkillEntry,
  SpellSlotTrack,
  TokenStatusMarker
} from "../../../../shared/types.js";
import { normalizeStoreState } from "../normalization.js";
import { parseCellKey, readAll, toBoolean, toIntegerBoolean } from "../helpers.js";
const tokenStatusMarkerSet = new Set<string>(TOKEN_STATUS_MARKERS);
function parseTokenStatusMarkers(value: string | null | undefined): TokenStatusMarker[] {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }
  if (tokenStatusMarkerSet.has(value)) {
    return [value as TokenStatusMarker];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return Array.from(
      new Set(parsed.filter((entry): entry is TokenStatusMarker => typeof entry === "string" && tokenStatusMarkerSet.has(entry)))
    );
  } catch {
    return [];
  }
}
function serializeTokenStatusMarkers(markers: TokenStatusMarker[]): string | null {
  return markers.length > 0 ? JSON.stringify(Array.from(new Set(markers))) : null;
}
export async function readRealtimeCampaign(database: DatabaseSync, campaignId: string): Promise<Campaign | null> {
  const campaignRow = (await database
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
    .get(campaignId)) as
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
  campaign.members = (
    await readAll<{
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
    )
  ).map((row) => ({
    userId: row.userId,
    name: row.name,
    email: row.email,
    role: row.role
  }));
  campaign.actors = (
    await readAll<{
      id: string;
      ownerId: string | null;
      name: string;
      kind: ActorKind;
      creatureSize: ActorSheet["creatureSize"];
      imageUrl: string;
      visionRange: number;
      tokenWidthSquares: number;
      tokenLengthSquares: number;
      color: string;
    }>(
      database,
      `
      SELECT
        id,
        owner_id as ownerId,
        name,
        kind,
        creature_size as creatureSize,
        image_url as imageUrl,
        vision_range as visionRange,
        token_width_squares as tokenWidthSquares,
        token_length_squares as tokenLengthSquares,
        color
      FROM actors
      WHERE campaign_id = ?
      ORDER BY sort_order, id
    `,
      campaignId
    )
  ).map((row) => createRealtimeActorShell(campaignId, row));
  const activeMap = (await database
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
          fog_enabled as fogEnabled,
          visibility_version as visibilityVersion
        FROM maps
        WHERE id = ?
        LIMIT 1
      `
    )
    .get(campaign.activeMapId)) as
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
        fogEnabled: number;
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
    fogEnabled: toBoolean(activeMap.fogEnabled),
    fog: [],
    visibilityVersion: activeMap.visibilityVersion ?? 1
  };
  map.walls = (
    await readAll<{
      id: string;
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      kind: MapWall["kind"];
      isOpen: number;
      isLocked: number;
    }>(
      database,
      `
      SELECT id, start_x as startX, start_y as startY, end_x as endX, end_y as endY, kind, is_open as isOpen, is_locked as isLocked
      FROM map_walls
      WHERE map_id = ?
      ORDER BY sort_order, id
    `,
      map.id
    )
  ).map((row) => ({
    id: row.id,
    start: { x: row.startX, y: row.startY },
    end: { x: row.endX, y: row.endY },
    kind: row.kind ?? "wall",
    isOpen: toBoolean(row.isOpen),
    isLocked: toBoolean(row.isLocked)
  }));
  map.teleporters = (
    await readAll<{
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
    )
  ).map((row) => ({
    id: row.id,
    pairNumber: row.pairNumber,
    pointA: { x: row.pointAX, y: row.pointAY },
    pointB: { x: row.pointBX, y: row.pointBY }
  }));
  campaign.maps = [map];
  campaign.mapAssignments = await readAll<{
    mapId: string;
    actorId: string;
  }>(
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
  campaign.tokens = (
    await readAll<{
      id: string;
      actorId: string;
      actorKind: ActorKind;
      mapId: string;
      x: number;
      y: number;
      size: number;
      widthSquares: number;
      heightSquares: number;
      rotationDegrees: number;
      color: string;
      label: string;
      imageUrl: string;
      visible: number;
      statusMarker: string | null;
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
        width_squares as widthSquares,
        height_squares as heightSquares,
        rotation_degrees as rotationDegrees,
        color,
        label,
        image_url as imageUrl,
        visible,
        status_marker as statusMarker
      FROM tokens
      WHERE campaign_id = ? AND map_id = ?
      ORDER BY sort_order, id
    `,
      campaignId,
      map.id
    )
  ).map((row) => ({
    id: row.id,
    actorId: row.actorId,
    actorKind: row.actorKind,
    mapId: row.mapId,
    x: row.x,
    y: row.y,
    size: row.size,
    widthSquares: row.widthSquares,
    heightSquares: row.heightSquares,
    rotationDegrees: row.rotationDegrees as BoardToken["rotationDegrees"],
    color: row.color,
    label: row.label,
    imageUrl: row.imageUrl,
    visible: toBoolean(row.visible),
    statusMarkers: parseTokenStatusMarkers(row.statusMarker)
  }));
  for (const row of await readAll<{
    userId: string;
    columnIndex: number;
    rowIndex: number;
  }>(
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
export async function readActiveBoardCampaign(database: DatabaseSync, campaignId: string) {
  return await readRealtimeCampaign(database, campaignId);
}
export async function readMapEditorMap(database: DatabaseSync, campaignId: string, mapId: string): Promise<CampaignMap | null> {
  const row = (await database
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
          fog_enabled as fogEnabled,
          visibility_version as visibilityVersion
        FROM maps
        WHERE id = ? AND campaign_id = ?
        LIMIT 1
      `
    )
    .get(mapId, campaignId)) as
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
        fogEnabled: number;
        visibilityVersion: number;
      }
    | undefined;
  if (!row) {
    return null;
  }
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
    fogEnabled: toBoolean(row.fogEnabled),
    fog: [],
    visibilityVersion: row.visibilityVersion ?? 1
  };
  map.walls = (
    await readAll<{
      id: string;
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      kind: MapWall["kind"];
      isOpen: number;
      isLocked: number;
    }>(
      database,
      `
      SELECT id, start_x as startX, start_y as startY, end_x as endX, end_y as endY, kind, is_open as isOpen, is_locked as isLocked
      FROM map_walls
      WHERE map_id = ?
      ORDER BY sort_order, id
    `,
      map.id
    )
  ).map((wall) => ({
    id: wall.id,
    start: { x: wall.startX, y: wall.startY },
    end: { x: wall.endX, y: wall.endY },
    kind: wall.kind ?? "wall",
    isOpen: toBoolean(wall.isOpen),
    isLocked: toBoolean(wall.isLocked)
  }));
  map.teleporters = (
    await readAll<{
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
    )
  ).map((teleporter) => ({
    id: teleporter.id,
    pairNumber: teleporter.pairNumber,
    pointA: { x: teleporter.pointAX, y: teleporter.pointAY },
    pointB: { x: teleporter.pointBX, y: teleporter.pointBY }
  }));
  const drawingsById = new Map<string, DrawingStroke>();
  map.drawings = (
    await readAll<{
      id: string;
      ownerId: string | null;
      kind: DrawingKind;
      text: string | null;
      fontFamily: DrawingTextFont | null;
      bold: number | null;
      italic: number | null;
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
        owner_id as ownerId,
        kind,
        text_content as text,
        font_family as fontFamily,
        is_bold as bold,
        is_italic as italic,
        color,
        stroke_opacity as strokeOpacity,
        fill_color as fillColor,
        fill_opacity as fillOpacity,
        size,
        rotation
      FROM map_drawings
      WHERE map_id = ?
      ORDER BY sort_order, id
    `,
      map.id
    )
  ).map((drawing) => {
    const stroke: DrawingStroke = {
      id: drawing.id,
      ownerId: drawing.ownerId ?? undefined,
      kind: drawing.kind ?? "freehand",
      text: drawing.text ?? "",
      fontFamily: drawing.fontFamily ?? "serif",
      bold: Boolean(drawing.bold),
      italic: Boolean(drawing.italic),
      color: drawing.color,
      strokeOpacity: drawing.strokeOpacity ?? 1,
      fillColor: drawing.fillColor ?? "",
      fillOpacity: drawing.fillOpacity ?? 0.22,
      size: drawing.size,
      rotation: drawing.rotation ?? 0,
      points: []
    };
    drawingsById.set(stroke.id, stroke);
    return stroke;
  });
  for (const point of await readAll<{
    strokeId: string;
    x: number;
    y: number;
  }>(
    database,
    `
      SELECT stroke_id as strokeId, x, y
      FROM map_drawing_points
      WHERE stroke_id IN (SELECT id FROM map_drawings WHERE map_id = ?)
      ORDER BY stroke_id, sort_order
    `,
    map.id
  )) {
    drawingsById.get(point.strokeId)?.points.push({ x: point.x, y: point.y });
  }
  return map;
}
export async function readCampaignMembersAndInvites(database: DatabaseSync, campaignId: string) {
  return {
    members: (
      await readAll<{
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
      )
    ).map((member) => ({
      userId: member.userId,
      name: member.name,
      email: member.email,
      role: member.role
    })),
    invites: (
      await readAll<{
        id: string;
        code: string;
        label: string;
        role: CampaignInvite["role"];
        createdAt: string;
        createdBy: string;
      }>(
        database,
        `
        SELECT id, code, label, role, created_at as createdAt, created_by as createdBy
        FROM campaign_invites
        WHERE campaign_id = ?
        ORDER BY sort_order, id
      `,
        campaignId
      )
    ).map((invite) => ({
      id: invite.id,
      code: invite.code,
      label: invite.label,
      role: invite.role,
      createdAt: invite.createdAt,
      createdBy: invite.createdBy
    }))
  };
}
export async function readCampaignCoreById(database: DatabaseSync, campaignId: string) {
  const row = (await database
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
    .get(campaignId)) as
    | {
        id: string;
        name: string;
        createdAt: string;
        createdBy: string;
        activeMapId: string;
        allowedSourceBooksJson: string;
      }
    | undefined;
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    activeMapId: row.activeMapId,
    allowedSourceBooks: parseJsonArray<string>(row.allowedSourceBooksJson)
  };
}
export async function readCampaignActiveMapId(database: DatabaseSync, campaignId: string) {
  const row = (await database
    .prepare(
      `
        SELECT active_map_id as activeMapId
        FROM campaigns
        WHERE id = ?
        LIMIT 1
      `
    )
    .get(campaignId)) as
    | {
        activeMapId: string;
      }
    | undefined;
  return row?.activeMapId ?? null;
}
export async function readCampaignRoleForUser(database: DatabaseSync, campaignId: string, userId: string) {
  const row = (await database
    .prepare(
      `
        SELECT role
        FROM campaign_members
        WHERE campaign_id = ? AND user_id = ?
        LIMIT 1
      `
    )
    .get(campaignId, userId)) as
    | {
        role: CampaignMember["role"];
      }
    | undefined;
  return row?.role ?? null;
}
export async function readCampaignMembers(database: DatabaseSync, campaignId: string) {
  return (
    await readAll<{
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
    )
  ).map((row) => ({
    userId: row.userId,
    name: row.name,
    email: row.email,
    role: row.role
  }));
}
export async function readCampaignSummaryForUser(database: DatabaseSync, campaignId: string, userId: string) {
  const row = (await database
    .prepare(
      `
        SELECT
          campaigns.id as id,
          campaigns.name as name,
          campaigns.created_at as createdAt,
          self_member.role as role,
          COUNT(DISTINCT all_members.user_id) as memberCount,
          COUNT(DISTINCT actors.id) as actorCount,
          COUNT(DISTINCT maps.id) as mapCount
        FROM campaigns
        INNER JOIN campaign_members self_member
          ON self_member.campaign_id = campaigns.id
         AND self_member.user_id = ?
        LEFT JOIN campaign_members all_members
          ON all_members.campaign_id = campaigns.id
        LEFT JOIN actors
          ON actors.campaign_id = campaigns.id
        LEFT JOIN maps
          ON maps.campaign_id = campaigns.id
        WHERE campaigns.id = ?
        GROUP BY campaigns.id, campaigns.name, campaigns.created_at, self_member.role
        LIMIT 1
      `
    )
    .get(userId, campaignId)) as
    | {
        id: string;
        name: string;
        createdAt: string;
        role: CampaignMember["role"];
        memberCount: number;
        actorCount: number;
        mapCount: number;
      }
    | undefined;
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    memberCount: row.memberCount,
    actorCount: row.actorCount,
    mapCount: row.mapCount,
    createdAt: row.createdAt
  } satisfies CampaignSummary;
}
export async function readCampaignInviteByCodeRecord(database: DatabaseSync, code: string) {
  const row = (await database
    .prepare(
      `
        SELECT
          id,
          campaign_id as campaignId,
          code,
          label,
          role,
          created_at as createdAt,
          created_by as createdBy
        FROM campaign_invites
        WHERE code = ?
        LIMIT 1
      `
    )
    .get(code)) as
    | {
        id: string;
        campaignId: string;
        code: string;
        label: string;
        role: CampaignInvite["role"];
        createdAt: string;
        createdBy: string;
      }
    | undefined;
  return row
    ? {
        id: row.id,
        campaignId: row.campaignId,
        code: row.code,
        label: row.label,
        role: row.role,
        createdAt: row.createdAt,
        createdBy: row.createdBy
      }
    : null;
}
export async function readCampaignInviteByIdRecord(database: DatabaseSync, campaignId: string, inviteId: string) {
  const row = (await database
    .prepare(
      `
        SELECT
          id,
          campaign_id as campaignId,
          code,
          label,
          role,
          created_at as createdAt,
          created_by as createdBy
        FROM campaign_invites
        WHERE campaign_id = ? AND id = ?
        LIMIT 1
      `
    )
    .get(campaignId, inviteId)) as
    | {
        id: string;
        campaignId: string;
        code: string;
        label: string;
        role: CampaignInvite["role"];
        createdAt: string;
        createdBy: string;
      }
    | undefined;
  return row
    ? {
        id: row.id,
        campaignId: row.campaignId,
        code: row.code,
        label: row.label,
        role: row.role,
        createdAt: row.createdAt,
        createdBy: row.createdBy
      }
    : null;
}
export async function readMapExists(database: DatabaseSync, campaignId: string, mapId: string) {
  const row = (await database
    .prepare(
      `
        SELECT 1 as found
        FROM maps
        WHERE campaign_id = ? AND id = ?
        LIMIT 1
      `
    )
    .get(campaignId, mapId)) as
    | {
        found: number;
      }
    | undefined;
  return Boolean(row?.found);
}
export async function readMapAssignment(database: DatabaseSync, campaignId: string, mapId: string, actorId: string) {
  const row = (await database
    .prepare(
      `
        SELECT map_id as mapId, actor_id as actorId
        FROM map_actor_assignments
        WHERE campaign_id = ? AND map_id = ? AND actor_id = ?
        LIMIT 1
      `
    )
    .get(campaignId, mapId, actorId)) as
    | {
        mapId: string;
        actorId: string;
      }
    | undefined;
  return row ? { mapId: row.mapId, actorId: row.actorId } : null;
}
export async function readMapAssignmentsForActor(database: DatabaseSync, campaignId: string, actorId: string) {
  return await readAll<{
    mapId: string;
    actorId: string;
  }>(
    database,
    `
      SELECT map_id as mapId, actor_id as actorId
      FROM map_actor_assignments
      WHERE campaign_id = ? AND actor_id = ?
      ORDER BY map_id
    `,
    campaignId,
    actorId
  );
}
export async function readTokenById(database: DatabaseSync, campaignId: string, tokenId: string): Promise<BoardToken | null> {
  const row = (await database
    .prepare(
      `
        SELECT
          id,
          actor_id as actorId,
          actor_kind as actorKind,
          map_id as mapId,
          x,
          y,
          size,
          width_squares as widthSquares,
          height_squares as heightSquares,
          rotation_degrees as rotationDegrees,
          color,
          label,
          image_url as imageUrl,
          visible,
          status_marker as statusMarker
        FROM tokens
        WHERE campaign_id = ? AND id = ?
        LIMIT 1
      `
    )
    .get(campaignId, tokenId)) as
    | {
        id: string;
        actorId: string;
        actorKind: ActorKind;
        mapId: string;
        x: number;
        y: number;
        size: number;
        widthSquares: number;
        heightSquares: number;
        rotationDegrees: number;
        color: string;
        label: string;
        imageUrl: string;
        visible: number;
        statusMarker: string | null;
      }
    | undefined;
  return row
    ? {
        id: row.id,
        actorId: row.actorId,
        actorKind: row.actorKind,
        mapId: row.mapId,
        x: row.x,
        y: row.y,
        size: row.size,
        widthSquares: row.widthSquares,
        heightSquares: row.heightSquares,
        rotationDegrees: row.rotationDegrees as BoardToken["rotationDegrees"],
        color: row.color,
        label: row.label,
        imageUrl: row.imageUrl,
        visible: toBoolean(row.visible),
        statusMarkers: parseTokenStatusMarkers(row.statusMarker)
      }
    : null;
}
export async function readTokensForActor(database: DatabaseSync, campaignId: string, actorId: string) {
  return (
    await readAll<{
      id: string;
      actorId: string;
      actorKind: ActorKind;
      mapId: string;
      x: number;
      y: number;
      size: number;
      widthSquares: number;
      heightSquares: number;
      rotationDegrees: number;
      color: string;
      label: string;
      imageUrl: string;
      visible: number;
      statusMarker: string | null;
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
        width_squares as widthSquares,
        height_squares as heightSquares,
        rotation_degrees as rotationDegrees,
        color,
        label,
        image_url as imageUrl,
        visible,
        status_marker as statusMarker
      FROM tokens
      WHERE campaign_id = ? AND actor_id = ?
      ORDER BY sort_order, id
    `,
      campaignId,
      actorId
    )
  ).map((row) => ({
    id: row.id,
    actorId: row.actorId,
    actorKind: row.actorKind,
    mapId: row.mapId,
    x: row.x,
    y: row.y,
    size: row.size,
    widthSquares: row.widthSquares,
    heightSquares: row.heightSquares,
    rotationDegrees: row.rotationDegrees as BoardToken["rotationDegrees"],
    color: row.color,
    label: row.label,
    imageUrl: row.imageUrl,
    visible: toBoolean(row.visible),
    statusMarkers: parseTokenStatusMarkers(row.statusMarker)
  }));
}
export async function readOwnedActorIdsForCampaignUser(database: DatabaseSync, campaignId: string, userId: string) {
  return (
    await readAll<{
      id: string;
    }>(
      database,
      `
      SELECT id
      FROM actors
      WHERE campaign_id = ? AND owner_id = ?
      ORDER BY sort_order, id
    `,
      campaignId,
      userId
    )
  ).map((row) => row.id);
}
export async function readChatActorContextById(
  database: DatabaseSync,
  campaignId: string,
  actorId: string
): Promise<ChatActorContext | null> {
  const row = (await database
    .prepare(
      `
        SELECT id as actorId, name as actorName, image_url as actorImageUrl, color as actorColor
        FROM actors
        WHERE campaign_id = ? AND id = ?
        LIMIT 1
      `
    )
    .get(campaignId, actorId)) as
    | {
        actorId: string;
        actorName: string;
        actorImageUrl: string;
        actorColor: string;
      }
    | undefined;
  return row
    ? {
        actorId: row.actorId,
        actorName: row.actorName,
        actorImageUrl: row.actorImageUrl,
        actorColor: row.actorColor
      }
    : null;
}
export async function readActorById(database: DatabaseSync, campaignId: string, actorId: string): Promise<ActorSheet | null> {
  const row = (await database
    .prepare(
      `
        SELECT
          id,
          owner_id as ownerId,
          template_id as templateId,
          name,
          kind,
          creature_size as creatureSize,
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
          initiative_roll as initiativeRoll,
          speed,
          proficiency_bonus as proficiencyBonus,
          inspiration,
          vision_range as visionRange,
          token_width_squares as tokenWidthSquares,
          token_length_squares as tokenLengthSquares,
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
        layout_json as layoutJson,
        build_json as buildJson,
        proficiencies_json as proficienciesJson,
        spell_state_json as spellStateJson,
        status_json as statusJson
      FROM actors
        WHERE campaign_id = ? AND id = ?
        LIMIT 1
      `
    )
    .get(campaignId, actorId)) as
    | {
        id: string;
        ownerId: string | null;
        templateId: string | null;
        name: string;
        kind: ActorKind;
        creatureSize: ActorSheet["creatureSize"];
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
        initiativeRoll: number | null;
        speed: number;
        proficiencyBonus: number;
        inspiration: number;
        visionRange: number;
        tokenWidthSquares: number;
        tokenLengthSquares: number;
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
        buildJson: string;
        proficienciesJson: string;
        spellStateJson: string;
        statusJson: string;
      }
    | undefined;
  if (!row) {
    return null;
  }
  const actor: ActorSheet = {
    id: row.id,
    campaignId,
    ownerId: row.ownerId ?? undefined,
    templateId: row.templateId ?? undefined,
    name: row.name,
    kind: row.kind,
    creatureSize: row.creatureSize,
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
    initiativeRoll: row.initiativeRoll,
    speed: row.speed,
    proficiencyBonus: row.proficiencyBonus,
    inspiration: toBoolean(row.inspiration),
    visionRange: row.visionRange,
    tokenWidthSquares: row.tokenWidthSquares,
    tokenLengthSquares: row.tokenLengthSquares,
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
    ...parseStoredActorProficiencies(row.proficienciesJson),
    spellSlots: [],
    features: [],
    spells: [],
    preparedSpells: parseJsonArray<string>(row.preparedSpellsJson),
    spellState: parseStoredActorSpellState(row.spellStateJson),
    talents: [],
    feats: [],
    bonuses: [],
    layout: parseJsonArray<ActorLayoutEntry>(row.layoutJson),
    attacks: [],
    armorItems: [],
    resources: [],
    inventory: [],
    ...parseStoredActorStatus(row.statusJson),
    currency: {
      pp: row.currencyPp,
      gp: row.currencyGp,
      ep: row.currencyEp,
      sp: row.currencySp,
      cp: row.currencyCp
    },
    notes: row.notes,
    color: row.color,
    build: parseJsonObject<PlayerNpcBuild>(row.buildJson)
  };
  actor.classes = (
    await readAll<{
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
        id,
        compendium_id as compendiumId,
        name,
        source,
        level,
        hit_die_faces as hitDieFaces,
        used_hit_dice as usedHitDice,
        spellcasting_ability as spellcastingAbility
      FROM actor_classes
      WHERE actor_id = ?
      ORDER BY sort_order, id
    `,
      actor.id
    )
  ).map((entry) => ({
    id: entry.id,
    compendiumId: entry.compendiumId,
    name: entry.name,
    source: entry.source,
    level: entry.level,
    hitDieFaces: entry.hitDieFaces,
    usedHitDice: entry.usedHitDice,
    spellcastingAbility: entry.spellcastingAbility
  }));
  actor.skills = (
    await readAll<{
      id: string;
      name: string;
      ability: AbilityKey;
      proficient: number;
      expertise: number;
    }>(
      database,
      `
      SELECT id, name, ability, proficient, expertise
      FROM actor_skills
      WHERE actor_id = ?
      ORDER BY sort_order, id
    `,
      actor.id
    )
  ).map((entry) => ({
    id: entry.id,
    name: entry.name,
    ability: entry.ability,
    proficient: toBoolean(entry.proficient),
    expertise: toBoolean(entry.expertise)
  }));
  actor.spellSlots = (
    await readAll<{
      level: number;
      total: number;
      used: number;
    }>(
      database,
      `
      SELECT level, total, used
      FROM actor_spell_slots
      WHERE actor_id = ?
      ORDER BY level
    `,
      actor.id
    )
  ).map((entry) => ({
    level: entry.level,
    total: entry.total,
    used: entry.used
  }));
  for (const entry of await readAll<{
    kind: "features" | "spells" | "talents" | "feats";
    value: string;
  }>(
    database,
    `
      SELECT kind, value
      FROM actor_text_entries
      WHERE actor_id = ?
      ORDER BY kind, sort_order
    `,
    actor.id
  )) {
    actor[entry.kind].push(entry.value);
  }
  actor.attacks = (
    await readAll<{
      id: string;
      name: string;
      attackBonus: number;
      damage: string;
      damageType: string;
      notes: string;
    }>(
      database,
      `
      SELECT id, name, attack_bonus as attackBonus, damage, damage_type as damageType, notes
      FROM actor_attacks
      WHERE actor_id = ?
      ORDER BY sort_order, id
    `,
      actor.id
    )
  ).map((entry) => ({
    id: entry.id,
    name: entry.name,
    attackBonus: entry.attackBonus,
    damage: entry.damage,
    damageType: entry.damageType,
    notes: entry.notes
  }));
  actor.armorItems = (
    await readAll<{
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
        id,
        name,
        kind,
        armor_class as armorClass,
        max_dex_bonus as maxDexBonus,
        bonus,
        equipped,
        notes
      FROM actor_armor_items
      WHERE actor_id = ?
      ORDER BY sort_order, id
    `,
      actor.id
    )
  ).map((entry) => ({
    id: entry.id,
    name: entry.name,
    kind: entry.kind,
    armorClass: entry.armorClass,
    maxDexBonus: entry.maxDexBonus,
    bonus: entry.bonus,
    equipped: toBoolean(entry.equipped),
    notes: entry.notes
  }));
  actor.bonuses = (
    await readAll<{
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
      SELECT id, name, source_type as sourceType, target_type as targetType, target_key as targetKey, value, enabled
      FROM actor_bonuses
      WHERE actor_id = ?
      ORDER BY sort_order, id
    `,
      actor.id
    )
  ).map((entry) => ({
    id: entry.id,
    name: entry.name,
    sourceType: entry.sourceType,
    targetType: entry.targetType,
    targetKey: entry.targetKey,
    value: entry.value,
    enabled: toBoolean(entry.enabled)
  }));
  actor.resources = (
    await readAll<{
      id: string;
      name: string;
      current: number;
      max: number;
      resetOn: string;
      restoreAmount: number;
    }>(
      database,
      `
      SELECT id, name, current_value as current, max_value as max, reset_on as resetOn, restore_amount as restoreAmount
      FROM actor_resources
      WHERE actor_id = ?
      ORDER BY sort_order, id
    `,
      actor.id
    )
  ).map((entry) => ({
    id: entry.id,
    name: entry.name,
    current: entry.current,
    max: entry.max,
    resetOn: entry.resetOn,
    restoreAmount: entry.restoreAmount
  }));
  actor.inventory = (
    await readAll<{
      id: string;
      name: string;
      itemType: InventoryEntry["type"];
      quantity: number;
      equipped: number;
      notes: string;
    }>(
      database,
      `
      SELECT id, name, item_type as itemType, quantity, equipped, notes
      FROM actor_inventory
      WHERE actor_id = ?
      ORDER BY sort_order, id
    `,
      actor.id
    )
  ).map((entry) => ({
    id: entry.id,
    name: entry.name,
    type: entry.itemType,
    quantity: entry.quantity,
    equipped: toBoolean(entry.equipped),
    notes: entry.notes
  }));
  return actor;
}
export async function readCampaignBoardState(database: DatabaseSync, campaignId: string, mapIds: string[]) {
  const campaignCore = await readCampaignCoreById(database, campaignId);
  if (!campaignCore) {
    return null;
  }
  const uniqueMapIds = Array.from(new Set(mapIds.filter((entry) => typeof entry === "string" && entry.length > 0)));
  const campaign: Campaign = {
    ...campaignCore,
    members: await readCampaignMembers(database, campaignId),
    invites: [],
    actors: [],
    maps: [],
    mapAssignments: [],
    tokens: [],
    chat: [],
    exploration: {}
  };
  campaign.actors = (
    await readAll<{
      id: string;
      ownerId: string | null;
      name: string;
      kind: ActorKind;
      creatureSize: ActorSheet["creatureSize"];
      imageUrl: string;
      visionRange: number;
      tokenWidthSquares: number;
      tokenLengthSquares: number;
      color: string;
    }>(
      database,
      `
      SELECT
        id,
        owner_id as ownerId,
        name,
        kind,
        creature_size as creatureSize,
        image_url as imageUrl,
        vision_range as visionRange,
        token_width_squares as tokenWidthSquares,
        token_length_squares as tokenLengthSquares,
        color
      FROM actors
      WHERE campaign_id = ?
      ORDER BY sort_order, id
    `,
      campaignId
    )
  ).map((row) => createRealtimeActorShell(campaignId, row));
  if (uniqueMapIds.length === 0) {
    return campaign;
  }
  const mapPlaceholders = uniqueMapIds.map(() => "?").join(", ");
  const mapQueryParams = [campaignId, ...uniqueMapIds];
  campaign.maps = (
    await readAll<{
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
      fogEnabled: number;
      visibilityVersion: number;
    }>(
      database,
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
        fog_enabled as fogEnabled,
        visibility_version as visibilityVersion
      FROM maps
      WHERE campaign_id = ? AND id IN (${mapPlaceholders})
      ORDER BY sort_order, id
    `,
      ...mapQueryParams
    )
  ).map((row) => ({
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
    fogEnabled: toBoolean(row.fogEnabled),
    fog: [],
    visibilityVersion: row.visibilityVersion ?? 1
  }));
  const mapsById = new Map(campaign.maps.map((map) => [map.id, map]));
  for (const row of await readAll<{
    id: string;
    mapId: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    kind: MapWall["kind"];
    isOpen: number;
    isLocked: number;
  }>(
    database,
    `
      SELECT id, map_id as mapId, start_x as startX, start_y as startY, end_x as endX, end_y as endY, kind, is_open as isOpen, is_locked as isLocked
      FROM map_walls
      WHERE map_id IN (${uniqueMapIds.map(() => "?").join(", ")})
      ORDER BY map_id, sort_order, id
    `,
    ...uniqueMapIds
  )) {
    mapsById.get(row.mapId)?.walls.push({
      id: row.id,
      start: { x: row.startX, y: row.startY },
      end: { x: row.endX, y: row.endY },
      kind: row.kind ?? "wall",
      isOpen: toBoolean(row.isOpen),
      isLocked: toBoolean(row.isLocked)
    });
  }
  for (const row of await readAll<{
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
      WHERE map_id IN (${uniqueMapIds.map(() => "?").join(", ")})
      ORDER BY map_id, sort_order, id
    `,
    ...uniqueMapIds
  )) {
    mapsById.get(row.mapId)?.teleporters.push({
      id: row.id,
      pairNumber: row.pairNumber,
      pointA: { x: row.pointAX, y: row.pointAY },
      pointB: { x: row.pointBX, y: row.pointBY }
    });
  }
  campaign.mapAssignments = await readAll<{
    mapId: string;
    actorId: string;
  }>(
    database,
    `
      SELECT map_id as mapId, actor_id as actorId
      FROM map_actor_assignments
      WHERE campaign_id = ? AND map_id IN (${mapPlaceholders})
      ORDER BY map_id, actor_id
    `,
    ...mapQueryParams
  );
  campaign.tokens = (
    await readAll<{
      id: string;
      actorId: string;
      actorKind: ActorKind;
      mapId: string;
      x: number;
      y: number;
      size: number;
      widthSquares: number;
      heightSquares: number;
      rotationDegrees: number;
      color: string;
      label: string;
      imageUrl: string;
      visible: number;
      statusMarker: string | null;
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
        width_squares as widthSquares,
        height_squares as heightSquares,
        rotation_degrees as rotationDegrees,
        color,
        label,
        image_url as imageUrl,
        visible,
        status_marker as statusMarker
      FROM tokens
      WHERE campaign_id = ? AND map_id IN (${mapPlaceholders})
      ORDER BY sort_order, id
    `,
      ...mapQueryParams
    )
  ).map((row) => ({
    id: row.id,
    actorId: row.actorId,
    actorKind: row.actorKind,
    mapId: row.mapId,
    x: row.x,
    y: row.y,
    size: row.size,
    widthSquares: row.widthSquares,
    heightSquares: row.heightSquares,
    rotationDegrees: row.rotationDegrees as BoardToken["rotationDegrees"],
    color: row.color,
    label: row.label,
    imageUrl: row.imageUrl,
    visible: toBoolean(row.visible),
    statusMarkers: parseTokenStatusMarkers(row.statusMarker)
  }));
  for (const row of await readAll<{
    userId: string;
    mapId: string;
    columnIndex: number;
    rowIndex: number;
  }>(
    database,
    `
      SELECT user_id as userId, map_id as mapId, column_index as columnIndex, row_index as rowIndex
      FROM exploration_cells
      WHERE campaign_id = ? AND map_id IN (${mapPlaceholders})
      ORDER BY user_id, map_id, column_index, row_index
    `,
    ...mapQueryParams
  )) {
    const userMap = (campaign.exploration[row.userId] ??= {});
    const cells = (userMap[row.mapId] ??= []);
    cells.push(`${row.columnIndex}:${row.rowIndex}`);
  }
  return campaign;
}
export function upsertCampaignToken(database: DatabaseSync, campaignId: string, token: Campaign["tokens"][number]) {
  database
    .prepare(
      `
        INSERT INTO tokens (
          id, campaign_id, sort_order, actor_id, actor_kind, map_id, x, y, size, width_squares, height_squares, rotation_degrees, color, label, image_url, visible, status_marker
        )
        VALUES (
          ?, ?, COALESCE((SELECT MAX(sort_order) + 1 FROM tokens WHERE campaign_id = ?), 0), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
        ON CONFLICT(id) DO UPDATE SET
          actor_id = excluded.actor_id,
          actor_kind = excluded.actor_kind,
          map_id = excluded.map_id,
          x = excluded.x,
          y = excluded.y,
          size = excluded.size,
          width_squares = excluded.width_squares,
          height_squares = excluded.height_squares,
          rotation_degrees = excluded.rotation_degrees,
          color = excluded.color,
          label = excluded.label,
          image_url = excluded.image_url,
          visible = excluded.visible,
          status_marker = excluded.status_marker
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
      token.widthSquares,
      token.heightSquares,
      token.rotationDegrees,
      token.color,
      token.label,
      token.imageUrl,
      toIntegerBoolean(token.visible),
      serializeTokenStatusMarkers(token.statusMarkers)
    );
}
export function updateCampaignDoorState(database: DatabaseSync, doorId: string, isOpen: boolean, isLocked: boolean) {
  database
    .prepare(
      `
        UPDATE map_walls
        SET is_open = ?, is_locked = ?
        WHERE id = ? AND kind = 'door'
      `
    )
    .run(toIntegerBoolean(isOpen), toIntegerBoolean(isLocked), doorId);
}
export function insertCampaignExplorationCells(database: DatabaseSync, campaignId: string, userId: string, mapId: string, cells: string[]) {
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
type PreparedStatement = ReturnType<DatabaseSync["prepare"]>;
interface CampaignWriteStatements {
  insertCampaign: PreparedStatement;
  insertCampaignMember: PreparedStatement;
  insertCampaignInvite: PreparedStatement;
  insertActor: PreparedStatement;
  insertActorClass: PreparedStatement;
  insertActorSkill: PreparedStatement;
  insertActorSpellSlot: PreparedStatement;
  insertActorTextEntry: PreparedStatement;
  insertActorAttack: PreparedStatement;
  insertActorArmorItem: PreparedStatement;
  insertActorBonus: PreparedStatement;
  insertActorResource: PreparedStatement;
  insertActorInventory: PreparedStatement;
  insertMap: PreparedStatement;
  insertMapWall: PreparedStatement;
  insertMapTeleporter: PreparedStatement;
  insertMapDrawing: PreparedStatement;
  insertMapDrawingPoint: PreparedStatement;
  insertMapActorAssignment: PreparedStatement;
  insertToken: PreparedStatement;
  insertChatMessage: PreparedStatement;
  insertChatRoll: PreparedStatement;
  insertChatRollValue: PreparedStatement;
  insertExplorationCell: PreparedStatement;
}
export function writeCampaign(database: DatabaseSync, campaign: Campaign, campaignOrder: number) {
  const normalizedCampaign = normalizeStoreState({
    users: [],
    sessions: [],
    campaigns: [campaign],
    compendium: {
      spells: [],
      monsters: [],
      feats: [],
      classes: [],
      books: [],
      variantRules: [],
      conditions: [],
      optionalFeatures: [],
      actions: [],
      backgrounds: [],
      items: [],
      languages: [],
      races: [],
      skills: []
    }
  }).campaigns[0];
  writeCampaignRecord(prepareCampaignWriteStatements(database), normalizedCampaign, campaignOrder);
}
function prepareCampaignWriteStatements(database: DatabaseSync): CampaignWriteStatements {
  return {
    insertCampaign: database.prepare(`
      INSERT INTO campaigns (id, sort_order, name, created_at, created_by, active_map_id, allowed_source_books_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `),
    insertCampaignMember: database.prepare(`
      INSERT INTO campaign_members (campaign_id, user_id, sort_order, name, email, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
    insertCampaignInvite: database.prepare(`
      INSERT INTO campaign_invites (id, campaign_id, sort_order, code, label, role, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    insertActor: database.prepare(`
      INSERT INTO actors (
        id, campaign_id, sort_order, owner_id, template_id, name, kind, image_url, class_name, species, background, alignment, level,
        challenge_rating, experience, spellcasting_ability, armor_class, initiative, initiative_roll, speed, creature_size, proficiency_bonus, inspiration,
        vision_range, token_width_squares, token_length_squares, hit_points_current, hit_points_max, hit_points_temp, hit_dice, ability_str, ability_dex, ability_con,
        ability_int, ability_wis, ability_cha, currency_pp, currency_gp, currency_ep, currency_sp, currency_cp, notes, color,
        prepared_spells_json, layout_json, build_json, proficiencies_json, spell_state_json, status_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    insertActorClass: database.prepare(`
      INSERT INTO actor_classes (actor_id, id, sort_order, compendium_id, name, source, level, hit_die_faces, used_hit_dice, spellcasting_ability)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    insertActorSkill: database.prepare(`
      INSERT INTO actor_skills (actor_id, id, sort_order, name, ability, proficient, expertise)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `),
    insertActorSpellSlot: database.prepare(`
      INSERT INTO actor_spell_slots (actor_id, level, total, used)
      VALUES (?, ?, ?, ?)
    `),
    insertActorTextEntry: database.prepare(`
      INSERT INTO actor_text_entries (actor_id, kind, sort_order, value)
      VALUES (?, ?, ?, ?)
    `),
    insertActorAttack: database.prepare(`
      INSERT INTO actor_attacks (actor_id, id, sort_order, name, attack_bonus, damage, damage_type, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    insertActorArmorItem: database.prepare(`
      INSERT INTO actor_armor_items (actor_id, id, sort_order, name, kind, armor_class, max_dex_bonus, bonus, equipped, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    insertActorBonus: database.prepare(`
      INSERT INTO actor_bonuses (actor_id, id, sort_order, name, source_type, target_type, target_key, value, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    insertActorResource: database.prepare(`
      INSERT INTO actor_resources (actor_id, id, sort_order, name, current_value, max_value, reset_on, restore_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    insertActorInventory: database.prepare(`
      INSERT INTO actor_inventory (actor_id, id, sort_order, name, item_type, quantity, equipped, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    insertMap: database.prepare(`
      INSERT INTO maps (
        id, campaign_id, sort_order, name, background_url, background_offset_x, background_offset_y, background_scale,
        width, height, grid_show, grid_cell_size, grid_scale, grid_offset_x, grid_offset_y, grid_color, fog_enabled, visibility_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    insertMapWall: database.prepare(`
      INSERT INTO map_walls (id, map_id, sort_order, start_x, start_y, end_x, end_y, kind, is_open, is_locked)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    insertMapTeleporter: database.prepare(`
      INSERT INTO map_teleporters (id, map_id, sort_order, pair_number, point_a_x, point_a_y, point_b_x, point_b_y)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    insertMapDrawing: database.prepare(`
      INSERT INTO map_drawings (
        id, map_id, sort_order, owner_id, kind, text_content, font_family, is_bold, is_italic, color, stroke_opacity, fill_color, fill_opacity, size, rotation
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    insertMapDrawingPoint: database.prepare(`
      INSERT INTO map_drawing_points (stroke_id, sort_order, x, y)
      VALUES (?, ?, ?, ?)
    `),
    insertMapActorAssignment: database.prepare(`
      INSERT INTO map_actor_assignments (campaign_id, map_id, actor_id)
      VALUES (?, ?, ?)
    `),
    insertToken: database.prepare(`
      INSERT INTO tokens (id, campaign_id, sort_order, actor_id, actor_kind, map_id, x, y, size, width_squares, height_squares, rotation_degrees, color, label, image_url, visible, status_marker)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    insertChatMessage: database.prepare(`
      INSERT INTO chat_messages (
        id, campaign_id, sort_order, user_id, user_name, text, created_at, kind,
        actor_id, actor_name, actor_image_url, actor_color
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    insertChatRoll: database.prepare(`
      INSERT INTO chat_rolls (id, message_id, label, notation, modifier, total, breakdown, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    insertChatRollValue: database.prepare(`
      INSERT INTO chat_roll_values (roll_id, sort_order, value)
      VALUES (?, ?, ?)
    `),
    insertExplorationCell: database.prepare(`
      INSERT INTO exploration_cells (campaign_id, user_id, map_id, column_index, row_index)
      VALUES (?, ?, ?, ?, ?)
    `)
  };
}
function writeCampaignRecord(statements: CampaignWriteStatements, campaign: Campaign, campaignOrder: number) {
  statements.insertCampaign.run(
    campaign.id,
    campaignOrder,
    campaign.name,
    campaign.createdAt,
    campaign.createdBy,
    campaign.activeMapId,
    JSON.stringify(campaign.allowedSourceBooks)
  );
  campaign.members.forEach((member, memberOrder) => {
    statements.insertCampaignMember.run(campaign.id, member.userId, memberOrder, member.name, member.email, member.role);
  });
  campaign.invites.forEach((invite, inviteOrder) => {
    statements.insertCampaignInvite.run(
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
    statements.insertActor.run(
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
      actor.initiativeRoll ?? null,
      actor.speed,
      actor.creatureSize,
      actor.proficiencyBonus,
      toIntegerBoolean(actor.inspiration),
      actor.visionRange,
      actor.tokenWidthSquares,
      actor.tokenLengthSquares,
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
      JSON.stringify(actor.layout),
      JSON.stringify(actor.build ?? null),
      JSON.stringify({
        savingThrowProficiencies: actor.savingThrowProficiencies,
        toolProficiencies: actor.toolProficiencies,
        languageProficiencies: actor.languageProficiencies
      }),
      JSON.stringify(actor.spellState),
      JSON.stringify({
        conditions: actor.conditions,
        exhaustionLevel: actor.exhaustionLevel,
        concentration: actor.concentration,
        deathSaves: actor.deathSaves
      })
    );
    actor.classes.forEach((actorClass, classOrder) => {
      statements.insertActorClass.run(
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
      statements.insertActorSkill.run(
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
      statements.insertActorSpellSlot.run(actor.id, slot.level, slot.total, slot.used);
    });
    writeActorTextEntries(statements.insertActorTextEntry, actor.id, "features", actor.features);
    writeActorTextEntries(statements.insertActorTextEntry, actor.id, "spells", actor.spells);
    writeActorTextEntries(statements.insertActorTextEntry, actor.id, "talents", actor.talents);
    writeActorTextEntries(statements.insertActorTextEntry, actor.id, "feats", actor.feats);
    actor.attacks.forEach((attack, attackOrder) => {
      statements.insertActorAttack.run(
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
      statements.insertActorArmorItem.run(
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
      statements.insertActorBonus.run(
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
      statements.insertActorResource.run(
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
      statements.insertActorInventory.run(
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
    statements.insertMap.run(
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
      toIntegerBoolean(map.fogEnabled),
      map.visibilityVersion ?? 1
    );
    map.walls.forEach((wall, wallOrder) => {
      statements.insertMapWall.run(
        wall.id,
        map.id,
        wallOrder,
        wall.start.x,
        wall.start.y,
        wall.end.x,
        wall.end.y,
        wall.kind ?? "wall",
        toIntegerBoolean(wall.kind === "door" ? wall.isOpen : false),
        toIntegerBoolean(wall.kind === "door" ? wall.isLocked : false)
      );
    });
    map.teleporters.forEach((teleporter, teleporterOrder) => {
      statements.insertMapTeleporter.run(
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
      statements.insertMapDrawing.run(
        stroke.id,
        map.id,
        strokeOrder,
        stroke.ownerId ?? null,
        stroke.kind ?? "freehand",
        stroke.text ?? "",
        stroke.fontFamily ?? "serif",
        toIntegerBoolean(stroke.bold ?? false),
        toIntegerBoolean(stroke.italic ?? false),
        stroke.color,
        stroke.strokeOpacity ?? 1,
        stroke.fillColor ?? "",
        stroke.fillOpacity ?? 0.22,
        stroke.size,
        stroke.rotation ?? 0
      );
      stroke.points.forEach((point, pointOrder) => {
        statements.insertMapDrawingPoint.run(stroke.id, pointOrder, point.x, point.y);
      });
    });
  });
  campaign.mapAssignments.forEach((assignment) => {
    statements.insertMapActorAssignment.run(campaign.id, assignment.mapId, assignment.actorId);
  });
  campaign.tokens.forEach((token, tokenOrder) => {
    statements.insertToken.run(
      token.id,
      campaign.id,
      tokenOrder,
      token.actorId,
      token.actorKind,
      token.mapId,
      token.x,
      token.y,
      token.size,
      token.widthSquares,
      token.heightSquares,
      token.rotationDegrees,
      token.color,
      token.label,
      token.imageUrl,
      toIntegerBoolean(token.visible),
      serializeTokenStatusMarkers(token.statusMarkers)
    );
  });
  campaign.chat.forEach((message, messageOrder) => {
    statements.insertChatMessage.run(
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
    statements.insertChatRoll.run(
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
      statements.insertChatRollValue.run(message.roll!.id, valueOrder, value);
    });
  });
  for (const [userId, perMap] of Object.entries(campaign.exploration)) {
    for (const [mapId, cells] of Object.entries(perMap)) {
      for (const key of new Set(cells)) {
        const parsed = parseCellKey(key);
        if (parsed) {
          statements.insertExplorationCell.run(campaign.id, userId, mapId, parsed.column, parsed.row);
        }
      }
    }
  }
}
function deleteCampaign(database: DatabaseSync, campaignId: string) {
  database.prepare("DELETE FROM campaigns WHERE id = ?").run(campaignId);
}
export async function listCampaignSummariesForUser(database: DatabaseSync, userId: string): Promise<CampaignSummary[]> {
  return (
    await readAll<{
      id: string;
      name: string;
      createdAt: string;
      role: CampaignMember["role"];
      memberCount: number;
      actorCount: number;
      mapCount: number;
    }>(
      database,
      `
      SELECT
        campaigns.id as id,
        campaigns.name as name,
        campaigns.created_at as createdAt,
        self_member.role as role,
        COUNT(DISTINCT all_members.user_id) as memberCount,
        COUNT(DISTINCT actors.id) as actorCount,
        COUNT(DISTINCT maps.id) as mapCount
      FROM campaigns
      INNER JOIN campaign_members self_member
        ON self_member.campaign_id = campaigns.id
       AND self_member.user_id = ?
      LEFT JOIN campaign_members all_members
        ON all_members.campaign_id = campaigns.id
      LEFT JOIN actors
        ON actors.campaign_id = campaigns.id
      LEFT JOIN maps
        ON maps.campaign_id = campaigns.id
      GROUP BY campaigns.id, campaigns.name, campaigns.created_at, self_member.role, campaigns.sort_order
      ORDER BY campaigns.sort_order, campaigns.created_at, campaigns.id
    `,
      userId
    )
  ).map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
    memberCount: row.memberCount,
    actorCount: row.actorCount,
    mapCount: row.mapCount,
    createdAt: row.createdAt
  }));
}
export async function listCampaignIdsForMember(database: DatabaseSync, userId: string) {
  return (
    await readAll<{
      campaignId: string;
    }>(
      database,
      `
      SELECT campaign_id as campaignId
      FROM campaign_members
      WHERE user_id = ?
      ORDER BY campaign_id
    `,
      userId
    )
  ).map((row) => row.campaignId);
}
async function readCampaignAggregateById(database: DatabaseSync, campaignId: string) {
  const campaignRow = (await database
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
    .get(campaignId)) as
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
  const actorsById = new Map<string, ActorSheet>();
  const mapsById = new Map<string, CampaignMap>();
  const drawingsById = new Map<string, DrawingStroke>();
  const messagesById = new Map<string, ChatMessage>();
  const rollsById = new Map<string, DiceRoll>();
  campaign.members = (
    await readAll<{
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
    )
  ).map((row) => ({
    userId: row.userId,
    name: row.name,
    email: row.email,
    role: row.role
  }));
  campaign.invites = (
    await readAll<{
      id: string;
      code: string;
      label: string;
      role: CampaignInvite["role"];
      createdAt: string;
      createdBy: string;
    }>(
      database,
      `
      SELECT id, code, label, role, created_at as createdAt, created_by as createdBy
      FROM campaign_invites
      WHERE campaign_id = ?
      ORDER BY sort_order, id
    `,
      campaignId
    )
  ).map((row) => ({
    id: row.id,
    code: row.code,
    label: row.label,
    role: row.role,
    createdAt: row.createdAt,
    createdBy: row.createdBy
  }));
  for (const row of await readAll<{
    id: string;
    ownerId: string | null;
    templateId: string | null;
    name: string;
    kind: ActorKind;
    creatureSize: ActorSheet["creatureSize"];
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
    initiativeRoll: number | null;
    speed: number;
    proficiencyBonus: number;
    inspiration: number;
    visionRange: number;
    tokenWidthSquares: number;
    tokenLengthSquares: number;
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
        buildJson: string;
        proficienciesJson: string;
        spellStateJson: string;
        statusJson: string;
  }>(
    database,
    `
      SELECT
        id,
        owner_id as ownerId,
        template_id as templateId,
        name,
        kind,
        creature_size as creatureSize,
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
        initiative_roll as initiativeRoll,
        speed,
        proficiency_bonus as proficiencyBonus,
        inspiration,
        vision_range as visionRange,
        token_width_squares as tokenWidthSquares,
        token_length_squares as tokenLengthSquares,
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
        layout_json as layoutJson,
        build_json as buildJson,
        proficiencies_json as proficienciesJson,
        spell_state_json as spellStateJson,
        status_json as statusJson
      FROM actors
      WHERE campaign_id = ?
      ORDER BY sort_order, id
    `,
    campaignId
  )) {
    const actor: ActorSheet = {
      id: row.id,
      campaignId,
      ownerId: row.ownerId ?? undefined,
      templateId: row.templateId ?? undefined,
      name: row.name,
      kind: row.kind,
      creatureSize: row.creatureSize,
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
      initiativeRoll: row.initiativeRoll,
      speed: row.speed,
      proficiencyBonus: row.proficiencyBonus,
      inspiration: toBoolean(row.inspiration),
      visionRange: row.visionRange,
      tokenWidthSquares: row.tokenWidthSquares,
      tokenLengthSquares: row.tokenLengthSquares,
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
      ...parseStoredActorProficiencies(row.proficienciesJson),
      spellSlots: [],
      features: [],
      spells: [],
      preparedSpells: parseJsonArray<string>(row.preparedSpellsJson),
      spellState: parseStoredActorSpellState(row.spellStateJson),
      talents: [],
      feats: [],
      bonuses: [],
      layout: parseJsonArray<ActorLayoutEntry>(row.layoutJson),
      attacks: [],
      armorItems: [],
      resources: [],
      inventory: [],
      ...parseStoredActorStatus(row.statusJson),
      currency: {
        pp: row.currencyPp,
        gp: row.currencyGp,
        ep: row.currencyEp,
        sp: row.currencySp,
        cp: row.currencyCp
      },
      notes: row.notes,
      color: row.color,
      build: parseJsonObject<PlayerNpcBuild>(row.buildJson)
    };
    campaign.actors.push(actor);
    actorsById.set(actor.id, actor);
  }
  for (const row of await readAll<{
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
      WHERE actor_id IN (SELECT id FROM actors WHERE campaign_id = ?)
      ORDER BY actor_id, sort_order, id
    `,
    campaignId
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
  for (const row of await readAll<{
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
      WHERE actor_id IN (SELECT id FROM actors WHERE campaign_id = ?)
      ORDER BY actor_id, sort_order, id
    `,
    campaignId
  )) {
    actorsById.get(row.actorId)?.skills.push({
      id: row.id,
      name: row.name,
      ability: row.ability,
      proficient: toBoolean(row.proficient),
      expertise: toBoolean(row.expertise)
    } satisfies SkillEntry);
  }
  for (const row of await readAll<{
    actorId: string;
    level: number;
    total: number;
    used: number;
  }>(
    database,
    `
      SELECT actor_id as actorId, level, total, used
      FROM actor_spell_slots
      WHERE actor_id IN (SELECT id FROM actors WHERE campaign_id = ?)
      ORDER BY actor_id, level
    `,
    campaignId
  )) {
    actorsById.get(row.actorId)?.spellSlots.push({
      level: row.level,
      total: row.total,
      used: row.used
    } satisfies SpellSlotTrack);
  }
  for (const row of await readAll<{
    actorId: string;
    kind: "features" | "spells" | "talents" | "feats";
    value: string;
  }>(
    database,
    `
      SELECT actor_id as actorId, kind, value
      FROM actor_text_entries
      WHERE actor_id IN (SELECT id FROM actors WHERE campaign_id = ?)
      ORDER BY actor_id, kind, sort_order
    `,
    campaignId
  )) {
    const actor = actorsById.get(row.actorId);
    if (actor) {
      actor[row.kind].push(row.value);
    }
  }
  for (const row of await readAll<{
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
      SELECT actor_id as actorId, id, name, attack_bonus as attackBonus, damage, damage_type as damageType, notes
      FROM actor_attacks
      WHERE actor_id IN (SELECT id FROM actors WHERE campaign_id = ?)
      ORDER BY actor_id, sort_order, id
    `,
    campaignId
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
  for (const row of await readAll<{
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
      WHERE actor_id IN (SELECT id FROM actors WHERE campaign_id = ?)
      ORDER BY actor_id, sort_order, id
    `,
    campaignId
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
  for (const row of await readAll<{
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
      WHERE actor_id IN (SELECT id FROM actors WHERE campaign_id = ?)
      ORDER BY actor_id, sort_order, id
    `,
    campaignId
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
  for (const row of await readAll<{
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
      WHERE actor_id IN (SELECT id FROM actors WHERE campaign_id = ?)
      ORDER BY actor_id, sort_order, id
    `,
    campaignId
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
  for (const row of await readAll<{
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
      WHERE actor_id IN (SELECT id FROM actors WHERE campaign_id = ?)
      ORDER BY actor_id, sort_order, id
    `,
    campaignId
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
  for (const row of await readAll<{
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
    fogEnabled: number;
    visibilityVersion: number;
  }>(
    database,
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
        fog_enabled as fogEnabled,
        visibility_version as visibilityVersion
      FROM maps
      WHERE campaign_id = ?
      ORDER BY sort_order, id
    `,
    campaignId
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
      fogEnabled: toBoolean(row.fogEnabled),
      fog: [],
      visibilityVersion: row.visibilityVersion ?? 1
    };
    campaign.maps.push(map);
    mapsById.set(map.id, map);
  }
  for (const row of await readAll<{
    id: string;
    mapId: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    kind: "wall" | "transparent" | "opaque" | "door";
    isOpen: number;
    isLocked: number;
  }>(
    database,
    `
      SELECT id, map_id as mapId, start_x as startX, start_y as startY, end_x as endX, end_y as endY, kind, is_open as isOpen, is_locked as isLocked
      FROM map_walls
      WHERE map_id IN (SELECT id FROM maps WHERE campaign_id = ?)
      ORDER BY map_id, sort_order, id
    `,
    campaignId
  )) {
    mapsById.get(row.mapId)?.walls.push({
      id: row.id,
      start: { x: row.startX, y: row.startY },
      end: { x: row.endX, y: row.endY },
      kind: row.kind ?? "wall",
      isOpen: Boolean(row.isOpen),
      isLocked: Boolean(row.isLocked)
    } satisfies MapWall);
  }
  for (const row of await readAll<{
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
      WHERE map_id IN (SELECT id FROM maps WHERE campaign_id = ?)
      ORDER BY map_id, sort_order, id
    `,
    campaignId
  )) {
    mapsById.get(row.mapId)?.teleporters.push({
      id: row.id,
      pairNumber: row.pairNumber,
      pointA: { x: row.pointAX, y: row.pointAY },
      pointB: { x: row.pointBX, y: row.pointBY }
    } satisfies MapTeleporter);
  }
  for (const row of await readAll<{
    id: string;
    mapId: string;
    ownerId: string | null;
    kind: DrawingKind;
    text: string | null;
    fontFamily: DrawingTextFont | null;
    bold: number | null;
    italic: number | null;
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
        text_content as text,
        font_family as fontFamily,
        is_bold as bold,
        is_italic as italic,
        color,
        stroke_opacity as strokeOpacity,
        fill_color as fillColor,
        fill_opacity as fillOpacity,
        size,
        rotation
      FROM map_drawings
      WHERE map_id IN (SELECT id FROM maps WHERE campaign_id = ?)
      ORDER BY map_id, sort_order, id
    `,
    campaignId
  )) {
    const stroke: DrawingStroke = {
      id: row.id,
      ownerId: row.ownerId ?? undefined,
      kind: row.kind ?? "freehand",
      text: row.text ?? "",
      fontFamily: row.fontFamily ?? "serif",
      bold: Boolean(row.bold),
      italic: Boolean(row.italic),
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
  for (const row of await readAll<{
    strokeId: string;
    x: number;
    y: number;
  }>(
    database,
    `
      SELECT stroke_id as strokeId, x, y
      FROM map_drawing_points
      WHERE stroke_id IN (
        SELECT id
        FROM map_drawings
        WHERE map_id IN (SELECT id FROM maps WHERE campaign_id = ?)
      )
      ORDER BY stroke_id, sort_order
    `,
    campaignId
  )) {
    drawingsById.get(row.strokeId)?.points.push({ x: row.x, y: row.y });
  }
  campaign.mapAssignments = await readAll<{
    mapId: string;
    actorId: string;
  }>(
    database,
    `
      SELECT map_id as mapId, actor_id as actorId
      FROM map_actor_assignments
      WHERE campaign_id = ?
      ORDER BY map_id, actor_id
    `,
    campaignId
  );
  campaign.tokens = (
    await readAll<{
      id: string;
      actorId: string;
      actorKind: ActorKind;
      mapId: string;
      x: number;
      y: number;
      size: number;
      widthSquares: number;
      heightSquares: number;
      rotationDegrees: number;
      color: string;
      label: string;
      imageUrl: string;
      visible: number;
      statusMarker: string | null;
    }>(
      database,
      `
      SELECT id, actor_id as actorId, actor_kind as actorKind, map_id as mapId, x, y, size, width_squares as widthSquares, height_squares as heightSquares, rotation_degrees as rotationDegrees, color, label, image_url as imageUrl, visible, status_marker as statusMarker
      FROM tokens
      WHERE campaign_id = ?
      ORDER BY sort_order, id
    `,
      campaignId
    )
  ).map((row) => ({
    id: row.id,
    actorId: row.actorId,
    actorKind: row.actorKind,
    mapId: row.mapId,
    x: row.x,
    y: row.y,
    size: row.size,
    widthSquares: row.widthSquares,
    heightSquares: row.heightSquares,
    rotationDegrees: row.rotationDegrees as BoardToken["rotationDegrees"],
    color: row.color,
    label: row.label,
    imageUrl: row.imageUrl,
    visible: toBoolean(row.visible),
    statusMarkers: parseTokenStatusMarkers(row.statusMarker)
  }));
  for (const row of await readAll<{
    id: string;
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
      WHERE campaign_id = ?
      ORDER BY sort_order, id
    `,
    campaignId
  )) {
    const message: ChatMessage = {
      id: row.id,
      campaignId,
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
    campaign.chat.push(message);
    messagesById.set(message.id, message);
  }
  for (const row of await readAll<{
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
      WHERE message_id IN (SELECT id FROM chat_messages WHERE campaign_id = ?)
      ORDER BY message_id
    `,
    campaignId
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
  for (const row of await readAll<{
    rollId: string;
    value: number;
  }>(
    database,
    `
      SELECT chat_roll_values.roll_id as rollId, chat_roll_values.value
      FROM chat_roll_values
      INNER JOIN chat_rolls
        ON chat_rolls.id = chat_roll_values.roll_id
      INNER JOIN chat_messages
        ON chat_messages.id = chat_rolls.message_id
      WHERE chat_messages.campaign_id = ?
      ORDER BY chat_roll_values.roll_id, chat_roll_values.sort_order
    `,
    campaignId
  )) {
    rollsById.get(row.rollId)?.rolls.push(row.value);
  }
  for (const row of await readAll<{
    userId: string;
    mapId: string;
    columnIndex: number;
    rowIndex: number;
  }>(
    database,
    `
      SELECT user_id as userId, map_id as mapId, column_index as columnIndex, row_index as rowIndex
      FROM exploration_cells
      WHERE campaign_id = ?
      ORDER BY user_id, map_id, column_index, row_index
    `,
    campaignId
  )) {
    const userMap = (campaign.exploration[row.userId] ??= {});
    const cells = (userMap[row.mapId] ??= []);
    cells.push(`${row.columnIndex}:${row.rowIndex}`);
  }
  return (
    normalizeStoreState({
      users: [],
      sessions: [],
      campaigns: [campaign],
      compendium: {
        spells: [],
        monsters: [],
        feats: [],
        classes: [],
        books: [],
        variantRules: [],
        conditions: [],
        optionalFeatures: [],
        actions: [],
        backgrounds: [],
        items: [],
        languages: [],
        races: [],
        skills: []
      }
    }).campaigns[0] ?? null
  );
}
export async function readCampaignSnapshotById(database: DatabaseSync, campaignId: string) {
  return await readCampaignAggregateById(database, campaignId);
}
export async function insertCampaignRecord(database: DatabaseSync, campaign: Campaign) {
  writeCampaign(database, campaign, await readNextSortOrder(database, "campaigns"));
}
export function deleteCampaignRecord(database: DatabaseSync, campaignId: string) {
  deleteCampaign(database, campaignId);
}
export async function insertCampaignMemberRecord(database: DatabaseSync, campaignId: string, member: CampaignMember) {
  database
    .prepare(
      `
        INSERT INTO campaign_members (campaign_id, user_id, sort_order, name, email, role)
        VALUES (?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      campaignId,
      member.userId,
      await readNextSortOrder(database, "campaign_members", "campaign_id", campaignId),
      member.name,
      member.email,
      member.role
    );
}
export async function insertCampaignInviteRecord(database: DatabaseSync, campaignId: string, invite: CampaignInvite) {
  database
    .prepare(
      `
        INSERT INTO campaign_invites (id, campaign_id, sort_order, code, label, role, created_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      invite.id,
      campaignId,
      await readNextSortOrder(database, "campaign_invites", "campaign_id", campaignId),
      invite.code,
      invite.label,
      invite.role,
      invite.createdAt,
      invite.createdBy
    );
}
export function deleteCampaignInviteByCode(database: DatabaseSync, code: string) {
  database
    .prepare(
      `
        DELETE FROM campaign_invites
        WHERE code = ?
      `
    )
    .run(code);
}
export function deleteCampaignInviteById(database: DatabaseSync, campaignId: string, inviteId: string) {
  database
    .prepare(
      `
        DELETE FROM campaign_invites
        WHERE campaign_id = ? AND id = ?
      `
    )
    .run(campaignId, inviteId);
}
export function deleteCampaignInvitesByCreator(database: DatabaseSync, campaignId: string, createdBy: string) {
  database
    .prepare(
      `
        DELETE FROM campaign_invites
        WHERE campaign_id = ? AND created_by = ?
      `
    )
    .run(campaignId, createdBy);
}
export function deleteCampaignMemberRecord(database: DatabaseSync, campaignId: string, userId: string) {
  database
    .prepare(
      `
        DELETE FROM campaign_members
        WHERE campaign_id = ? AND user_id = ?
      `
    )
    .run(campaignId, userId);
}
export function updateCampaignMemberRole(database: DatabaseSync, campaignId: string, userId: string, role: CampaignMember["role"]) {
  database
    .prepare(
      `
        UPDATE campaign_members
        SET role = ?
        WHERE campaign_id = ? AND user_id = ?
      `
    )
    .run(role, campaignId, userId);
}
export function updateCampaignCreatedBy(database: DatabaseSync, campaignId: string, createdBy: string) {
  database
    .prepare(
      `
        UPDATE campaigns
        SET created_by = ?
        WHERE id = ?
      `
    )
    .run(createdBy, campaignId);
}
export function deleteCampaignChatMessagesByUser(database: DatabaseSync, campaignId: string, userId: string) {
  database
    .prepare(
      `
        DELETE FROM chat_messages
        WHERE campaign_id = ? AND user_id = ?
      `
    )
    .run(campaignId, userId);
}
export function deleteCampaignExplorationForUser(database: DatabaseSync, campaignId: string, userId: string) {
  database
    .prepare(
      `
        DELETE FROM exploration_cells
        WHERE campaign_id = ? AND user_id = ?
      `
    )
    .run(campaignId, userId);
}
export function updateCampaignActiveMap(database: DatabaseSync, campaignId: string, mapId: string) {
  database
    .prepare(
      `
        UPDATE campaigns
        SET active_map_id = ?
        WHERE id = ?
      `
    )
    .run(mapId, campaignId);
}
export async function upsertActorRecord(database: DatabaseSync, campaignId: string, actor: ActorSheet) {
  const sortOrder =
    (await readExistingSortOrder(database, "actors", actor.id)) ?? (await readNextSortOrder(database, "actors", "campaign_id", campaignId));
  database
    .prepare(
      `
        INSERT INTO actors (
          id, campaign_id, sort_order, owner_id, template_id, name, kind, image_url, class_name, species, background, alignment, level,
          challenge_rating, experience, spellcasting_ability, armor_class, initiative, initiative_roll, speed, creature_size, proficiency_bonus, inspiration,
          vision_range, token_width_squares, token_length_squares, hit_points_current, hit_points_max, hit_points_temp, hit_dice, ability_str, ability_dex, ability_con,
          ability_int, ability_wis, ability_cha, currency_pp, currency_gp, currency_ep, currency_sp, currency_cp, notes, color,
          prepared_spells_json, layout_json, build_json, proficiencies_json, spell_state_json, status_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          campaign_id = excluded.campaign_id,
          sort_order = excluded.sort_order,
          owner_id = excluded.owner_id,
          template_id = excluded.template_id,
          name = excluded.name,
          kind = excluded.kind,
          image_url = excluded.image_url,
          class_name = excluded.class_name,
          species = excluded.species,
          background = excluded.background,
          alignment = excluded.alignment,
          level = excluded.level,
          challenge_rating = excluded.challenge_rating,
          experience = excluded.experience,
          spellcasting_ability = excluded.spellcasting_ability,
          armor_class = excluded.armor_class,
          initiative = excluded.initiative,
          initiative_roll = excluded.initiative_roll,
          speed = excluded.speed,
          creature_size = excluded.creature_size,
          proficiency_bonus = excluded.proficiency_bonus,
          inspiration = excluded.inspiration,
          vision_range = excluded.vision_range,
          token_width_squares = excluded.token_width_squares,
          token_length_squares = excluded.token_length_squares,
          hit_points_current = excluded.hit_points_current,
          hit_points_max = excluded.hit_points_max,
          hit_points_temp = excluded.hit_points_temp,
          hit_dice = excluded.hit_dice,
          ability_str = excluded.ability_str,
          ability_dex = excluded.ability_dex,
          ability_con = excluded.ability_con,
          ability_int = excluded.ability_int,
          ability_wis = excluded.ability_wis,
          ability_cha = excluded.ability_cha,
          currency_pp = excluded.currency_pp,
          currency_gp = excluded.currency_gp,
          currency_ep = excluded.currency_ep,
          currency_sp = excluded.currency_sp,
          currency_cp = excluded.currency_cp,
          notes = excluded.notes,
          color = excluded.color,
          prepared_spells_json = excluded.prepared_spells_json,
          layout_json = excluded.layout_json,
          build_json = excluded.build_json,
          proficiencies_json = excluded.proficiencies_json,
          spell_state_json = excluded.spell_state_json,
          status_json = excluded.status_json
      `
    )
    .run(
      actor.id,
      campaignId,
      sortOrder,
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
      actor.initiativeRoll ?? null,
      actor.speed,
      actor.creatureSize,
      actor.proficiencyBonus,
      toIntegerBoolean(actor.inspiration),
      actor.visionRange,
      actor.tokenWidthSquares,
      actor.tokenLengthSquares,
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
      JSON.stringify(actor.layout),
      JSON.stringify(actor.build ?? null),
      JSON.stringify({
        savingThrowProficiencies: actor.savingThrowProficiencies,
        toolProficiencies: actor.toolProficiencies,
        languageProficiencies: actor.languageProficiencies
      }),
      JSON.stringify(actor.spellState),
      JSON.stringify({
        conditions: actor.conditions,
        exhaustionLevel: actor.exhaustionLevel,
        concentration: actor.concentration,
        deathSaves: actor.deathSaves
      })
    );
  database.prepare("DELETE FROM actor_classes WHERE actor_id = ?").run(actor.id);
  database.prepare("DELETE FROM actor_skills WHERE actor_id = ?").run(actor.id);
  database.prepare("DELETE FROM actor_spell_slots WHERE actor_id = ?").run(actor.id);
  database.prepare("DELETE FROM actor_text_entries WHERE actor_id = ?").run(actor.id);
  database.prepare("DELETE FROM actor_attacks WHERE actor_id = ?").run(actor.id);
  database.prepare("DELETE FROM actor_armor_items WHERE actor_id = ?").run(actor.id);
  database.prepare("DELETE FROM actor_bonuses WHERE actor_id = ?").run(actor.id);
  database.prepare("DELETE FROM actor_resources WHERE actor_id = ?").run(actor.id);
  database.prepare("DELETE FROM actor_inventory WHERE actor_id = ?").run(actor.id);
  actor.classes.forEach((actorClass, classOrder) => {
    database
      .prepare(
        `
          INSERT INTO actor_classes (actor_id, id, sort_order, compendium_id, name, source, level, hit_die_faces, used_hit_dice, spellcasting_ability)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
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
    database
      .prepare(
        `
          INSERT INTO actor_skills (actor_id, id, sort_order, name, ability, proficient, expertise)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
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
    database
      .prepare(
        `
          INSERT INTO actor_spell_slots (actor_id, level, total, used)
          VALUES (?, ?, ?, ?)
        `
      )
      .run(actor.id, slot.level, slot.total, slot.used);
  });
  insertActorTextEntries(database, actor.id, "features", actor.features);
  insertActorTextEntries(database, actor.id, "spells", actor.spells);
  insertActorTextEntries(database, actor.id, "talents", actor.talents);
  insertActorTextEntries(database, actor.id, "feats", actor.feats);
  actor.attacks.forEach((attack, attackOrder) => {
    database
      .prepare(
        `
          INSERT INTO actor_attacks (actor_id, id, sort_order, name, attack_bonus, damage, damage_type, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(actor.id, attack.id, attackOrder, attack.name, attack.attackBonus, attack.damage, attack.damageType, attack.notes);
  });
  actor.armorItems.forEach((item, itemOrder) => {
    database
      .prepare(
        `
          INSERT INTO actor_armor_items (actor_id, id, sort_order, name, kind, armor_class, max_dex_bonus, bonus, equipped, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
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
    database
      .prepare(
        `
          INSERT INTO actor_bonuses (actor_id, id, sort_order, name, source_type, target_type, target_key, value, enabled)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
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
    database
      .prepare(
        `
          INSERT INTO actor_resources (actor_id, id, sort_order, name, current_value, max_value, reset_on, restore_amount)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(actor.id, resource.id, resourceOrder, resource.name, resource.current, resource.max, resource.resetOn, resource.restoreAmount);
  });
  actor.inventory.forEach((item, itemOrder) => {
    database
      .prepare(
        `
          INSERT INTO actor_inventory (actor_id, id, sort_order, name, item_type, quantity, equipped, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(actor.id, item.id, itemOrder, item.name, item.type, item.quantity, toIntegerBoolean(item.equipped), item.notes);
  });
}
export function deleteActorRecord(database: DatabaseSync, actorId: string) {
  database
    .prepare(
      `
        DELETE FROM actors
        WHERE id = ?
      `
    )
    .run(actorId);
}
export async function upsertMapRecord(database: DatabaseSync, campaignId: string, map: CampaignMap) {
  const sortOrder =
    (await readExistingSortOrder(database, "maps", map.id)) ?? (await readNextSortOrder(database, "maps", "campaign_id", campaignId));
  database
    .prepare(
      `
        INSERT INTO maps (
          id, campaign_id, sort_order, name, background_url, background_offset_x, background_offset_y, background_scale,
          width, height, grid_show, grid_cell_size, grid_scale, grid_offset_x, grid_offset_y, grid_color, fog_enabled, visibility_version
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          campaign_id = excluded.campaign_id,
          sort_order = excluded.sort_order,
          name = excluded.name,
          background_url = excluded.background_url,
          background_offset_x = excluded.background_offset_x,
          background_offset_y = excluded.background_offset_y,
          background_scale = excluded.background_scale,
          width = excluded.width,
          height = excluded.height,
          grid_show = excluded.grid_show,
          grid_cell_size = excluded.grid_cell_size,
          grid_scale = excluded.grid_scale,
          grid_offset_x = excluded.grid_offset_x,
          grid_offset_y = excluded.grid_offset_y,
          grid_color = excluded.grid_color,
          fog_enabled = excluded.fog_enabled,
          visibility_version = excluded.visibility_version
      `
    )
    .run(
      map.id,
      campaignId,
      sortOrder,
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
      toIntegerBoolean(map.fogEnabled),
      map.visibilityVersion ?? 1
    );
  database.prepare("DELETE FROM map_walls WHERE map_id = ?").run(map.id);
  database.prepare("DELETE FROM map_teleporters WHERE map_id = ?").run(map.id);
  database.prepare("DELETE FROM map_drawings WHERE map_id = ?").run(map.id);
  map.walls.forEach((wall, wallOrder) => {
    database
      .prepare(
        `
          INSERT INTO map_walls (id, map_id, sort_order, start_x, start_y, end_x, end_y, kind, is_open, is_locked)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        wall.id,
        map.id,
        wallOrder,
        wall.start.x,
        wall.start.y,
        wall.end.x,
        wall.end.y,
        wall.kind ?? "wall",
        toIntegerBoolean(wall.kind === "door" ? wall.isOpen : false),
        toIntegerBoolean(wall.kind === "door" ? wall.isLocked : false)
      );
  });
  map.teleporters.forEach((teleporter, teleporterOrder) => {
    database
      .prepare(
        `
          INSERT INTO map_teleporters (id, map_id, sort_order, pair_number, point_a_x, point_a_y, point_b_x, point_b_y)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
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
  map.drawings.forEach(async (drawing) => {
    await insertDrawingRecord(database, map.id, drawing);
  });
}
export function insertMapAssignmentRecord(database: DatabaseSync, campaignId: string, assignment: MapActorAssignment) {
  database
    .prepare(
      `
        INSERT OR IGNORE INTO map_actor_assignments (campaign_id, map_id, actor_id)
        VALUES (?, ?, ?)
      `
    )
    .run(campaignId, assignment.mapId, assignment.actorId);
}
export function deleteMapAssignmentRecord(database: DatabaseSync, campaignId: string, mapId: string, actorId: string) {
  database
    .prepare(
      `
        DELETE FROM map_actor_assignments
        WHERE campaign_id = ? AND map_id = ? AND actor_id = ?
      `
    )
    .run(campaignId, mapId, actorId);
}
export function deleteTokenRecord(database: DatabaseSync, tokenId: string) {
  database
    .prepare(
      `
        DELETE FROM tokens
        WHERE id = ?
      `
    )
    .run(tokenId);
}
export function deleteTokensForActorOnMap(database: DatabaseSync, mapId: string, actorId: string) {
  database
    .prepare(
      `
        DELETE FROM tokens
        WHERE map_id = ? AND actor_id = ?
      `
    )
    .run(mapId, actorId);
}
export function replaceCampaignExploration(database: DatabaseSync, campaignId: string, exploration: Campaign["exploration"]) {
  database
    .prepare(
      `
        DELETE FROM exploration_cells
        WHERE campaign_id = ?
      `
    )
    .run(campaignId);
  for (const [userId, perMap] of Object.entries(exploration)) {
    for (const [mapId, cells] of Object.entries(perMap)) {
      insertCampaignExplorationCells(database, campaignId, userId, mapId, cells);
    }
  }
}
export function replaceMapExploration(database: DatabaseSync, campaignId: string, mapId: string, exploration: Campaign["exploration"]) {
  clearMapExploration(database, campaignId, mapId);
  for (const [userId, perMap] of Object.entries(exploration)) {
    insertCampaignExplorationCells(database, campaignId, userId, mapId, perMap[mapId] ?? []);
  }
}
export function replaceUserMapExploration(database: DatabaseSync, campaignId: string, userId: string, mapId: string, cells: string[]) {
  database
    .prepare(
      `
        DELETE FROM exploration_cells
        WHERE campaign_id = ? AND user_id = ? AND map_id = ?
      `
    )
    .run(campaignId, userId, mapId);
  insertCampaignExplorationCells(database, campaignId, userId, mapId, cells);
}
export function clearMapExploration(database: DatabaseSync, campaignId: string, mapId: string) {
  database
    .prepare(
      `
        DELETE FROM exploration_cells
        WHERE campaign_id = ? AND map_id = ?
      `
    )
    .run(campaignId, mapId);
}
export function incrementMapVisibilityVersion(database: DatabaseSync, mapId: string) {
  database
    .prepare(
      `
        UPDATE maps
        SET visibility_version = visibility_version + 1
        WHERE id = ?
      `
    )
    .run(mapId);
}
export async function insertChatMessageRecord(database: DatabaseSync, message: ChatMessage) {
  const sortOrder = await readNextSortOrder(database, "chat_messages", "campaign_id", message.campaignId);
  database
    .prepare(
      `
        INSERT INTO chat_messages (
          id, campaign_id, sort_order, user_id, user_name, text, created_at, kind,
          actor_id, actor_name, actor_image_url, actor_color
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      message.id,
      message.campaignId,
      sortOrder,
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
  database
    .prepare(
      `
        INSERT INTO chat_rolls (id, message_id, label, notation, modifier, total, breakdown, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(
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
    database
      .prepare(
        `
          INSERT INTO chat_roll_values (roll_id, sort_order, value)
          VALUES (?, ?, ?)
        `
      )
      .run(message.roll!.id, valueOrder, value);
  });
}
export async function trimCampaignChatRecords(database: DatabaseSync, campaignId: string, limit = 200) {
  const overflow = await readAll<{
    id: string;
  }>(
    database,
    `
      SELECT id
      FROM chat_messages
      WHERE campaign_id = ?
      ORDER BY sort_order DESC, id DESC
      LIMIT -1 OFFSET ?
    `,
    campaignId,
    limit
  );
  for (const row of overflow) {
    database.prepare("DELETE FROM chat_messages WHERE id = ?").run(row.id);
  }
}
export async function insertDrawingRecord(database: DatabaseSync, mapId: string, drawing: DrawingStroke) {
  const sortOrder = await readNextSortOrder(database, "map_drawings", "map_id", mapId);
  database
    .prepare(
      `
        INSERT INTO map_drawings (
          id, map_id, sort_order, owner_id, kind, text_content, font_family, is_bold, is_italic, color, stroke_opacity, fill_color, fill_opacity, size, rotation
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      drawing.id,
      mapId,
      sortOrder,
      drawing.ownerId ?? null,
      drawing.kind ?? "freehand",
      drawing.text ?? "",
      drawing.fontFamily ?? "serif",
      toIntegerBoolean(drawing.bold ?? false),
      toIntegerBoolean(drawing.italic ?? false),
      drawing.color,
      drawing.strokeOpacity ?? 1,
      drawing.fillColor ?? "",
      drawing.fillOpacity ?? 0.22,
      drawing.size,
      drawing.rotation ?? 0
    );
  drawing.points.forEach((point, pointOrder) => {
    database
      .prepare(
        `
          INSERT INTO map_drawing_points (stroke_id, sort_order, x, y)
          VALUES (?, ?, ?, ?)
        `
      )
      .run(drawing.id, pointOrder, point.x, point.y);
  });
}
export function updateDrawingRecord(database: DatabaseSync, drawing: DrawingStroke) {
  database
    .prepare(
      `
        UPDATE map_drawings
        SET kind = ?, text_content = ?, font_family = ?, is_bold = ?, is_italic = ?, color = ?, stroke_opacity = ?, fill_color = ?, fill_opacity = ?, size = ?, rotation = ?
        WHERE id = ?
      `
    )
    .run(
      drawing.kind ?? "freehand",
      drawing.text ?? "",
      drawing.fontFamily ?? "serif",
      toIntegerBoolean(drawing.bold ?? false),
      toIntegerBoolean(drawing.italic ?? false),
      drawing.color,
      drawing.strokeOpacity ?? 1,
      drawing.fillColor ?? "",
      drawing.fillOpacity ?? 0.22,
      drawing.size,
      drawing.rotation ?? 0,
      drawing.id
    );
  replaceDrawingPoints(database, drawing.id, drawing.points);
}
export function replaceDrawingPoints(database: DatabaseSync, drawingId: string, points: Point[]) {
  database.prepare("DELETE FROM map_drawing_points WHERE stroke_id = ?").run(drawingId);
  points.forEach((point, pointOrder) => {
    database
      .prepare(
        `
          INSERT INTO map_drawing_points (stroke_id, sort_order, x, y)
          VALUES (?, ?, ?, ?)
        `
      )
      .run(drawingId, pointOrder, point.x, point.y);
  });
}
export function deleteDrawingRecords(database: DatabaseSync, drawingIds: string[]) {
  const deleteDrawing = database.prepare("DELETE FROM map_drawings WHERE id = ?");
  for (const drawingId of drawingIds) {
    deleteDrawing.run(drawingId);
  }
}
export function clearMapDrawingRecords(database: DatabaseSync, mapId: string) {
  database.prepare("DELETE FROM map_drawings WHERE map_id = ?").run(mapId);
}
async function readExistingSortOrder(database: DatabaseSync, table: string, id: string) {
  const row = (await database.prepare(`SELECT sort_order as sortOrder FROM ${table} WHERE id = ? LIMIT 1`).get(id)) as
    | {
        sortOrder: number;
      }
    | undefined;
  return row?.sortOrder ?? null;
}
async function readNextSortOrder(database: DatabaseSync, table: string, filterColumn?: string, filterValue?: string) {
  if (filterColumn) {
    if (typeof filterValue !== "string") {
      throw new Error(`Missing filter value for ${table}.${filterColumn} sort order lookup.`);
    }
    const row = (await database
      .prepare(`SELECT COALESCE(MAX(sort_order), -1) + 1 as nextSortOrder FROM ${table} WHERE ${filterColumn} = ?`)
      .get(filterValue)) as {
      nextSortOrder: number;
    };
    return row.nextSortOrder;
  }
  const row = (await database.prepare(`SELECT COALESCE(MAX(sort_order), -1) + 1 as nextSortOrder FROM ${table}`).get()) as {
    nextSortOrder: number;
  };
  return row.nextSortOrder;
}
function insertActorTextEntries(
  database: DatabaseSync,
  actorId: string,
  kind: "features" | "spells" | "talents" | "feats",
  values: string[]
) {
  const statement = database.prepare(`
    INSERT INTO actor_text_entries (actor_id, kind, sort_order, value)
    VALUES (?, ?, ?, ?)
  `);
  values.forEach((value, index) => {
    statement.run(actorId, kind, index, value);
  });
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
    creatureSize: ActorSheet["creatureSize"];
    imageUrl: string;
    visionRange: number;
    tokenWidthSquares: number;
    tokenLengthSquares: number;
    color: string;
  }
): ActorSheet {
  return {
    id: row.id,
    campaignId,
    ownerId: row.ownerId ?? undefined,
    name: row.name,
    kind: row.kind,
    creatureSize: row.creatureSize,
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
    tokenWidthSquares: row.tokenWidthSquares,
    tokenLengthSquares: row.tokenLengthSquares,
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
    savingThrowProficiencies: [],
    toolProficiencies: [],
    languageProficiencies: [],
    spellSlots: [],
    features: [],
    spells: [],
    preparedSpells: [],
    spellState: {
      spellbook: [],
      alwaysPrepared: [],
      atWill: [],
      perShortRest: [],
      perLongRest: []
    },
    talents: [],
    feats: [],
    bonuses: [],
    layout: [],
    attacks: [],
    armorItems: [],
    resources: [],
    inventory: [],
    conditions: [],
    exhaustionLevel: 0,
    concentration: false,
    deathSaves: {
      successes: 0,
      failures: 0,
      history: []
    },
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

function parseJsonObject<T>(raw: string): T | undefined {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as T) : undefined;
  } catch {
    return undefined;
  }
}

function parseStoredActorProficiencies(raw: string) {
  const parsed =
    parseJsonObject<{
      savingThrowProficiencies?: unknown;
      toolProficiencies?: unknown;
      languageProficiencies?: unknown;
    }>(raw) ?? {};

  return {
    savingThrowProficiencies: normalizeStoredAbilityKeys(parsed.savingThrowProficiencies),
    toolProficiencies: normalizeStoredStringArray(parsed.toolProficiencies),
    languageProficiencies: normalizeStoredStringArray(parsed.languageProficiencies)
  };
}

function parseStoredActorSpellState(raw: string): ActorSheet["spellState"] {
  const parsed =
    parseJsonObject<{
      spellbook?: unknown;
      alwaysPrepared?: unknown;
      atWill?: unknown;
      perShortRest?: unknown;
      perLongRest?: unknown;
    }>(raw) ?? {};

  return {
    spellbook: normalizeStoredStringArray(parsed.spellbook),
    alwaysPrepared: normalizeStoredStringArray(parsed.alwaysPrepared),
    atWill: normalizeStoredStringArray(parsed.atWill),
    perShortRest: normalizeStoredStringArray(parsed.perShortRest),
    perLongRest: normalizeStoredStringArray(parsed.perLongRest)
  };
}

function parseStoredActorStatus(raw: string) {
  const parsed =
    parseJsonObject<{
      conditions?: unknown;
      exhaustionLevel?: unknown;
      concentration?: unknown;
      deathSaves?: unknown;
    }>(raw) ?? {};
  const deathSaves =
    parsed.deathSaves && typeof parsed.deathSaves === "object"
      ? (parsed.deathSaves as Partial<ActorSheet["deathSaves"]>)
      : {};

  return {
    conditions: normalizeStoredTokenStatusArray(parsed.conditions),
    exhaustionLevel:
      typeof parsed.exhaustionLevel === "number" && Number.isFinite(parsed.exhaustionLevel)
        ? Math.max(0, Math.min(6, Math.round(parsed.exhaustionLevel)))
        : 0,
    concentration: Boolean(parsed.concentration),
    deathSaves: {
      successes:
        typeof deathSaves.successes === "number" && Number.isFinite(deathSaves.successes)
          ? Math.max(0, Math.min(3, Math.round(deathSaves.successes)))
          : 0,
      failures:
        typeof deathSaves.failures === "number" && Number.isFinite(deathSaves.failures)
          ? Math.max(0, Math.min(3, Math.round(deathSaves.failures)))
          : 0,
      history: Array.isArray(deathSaves.history)
        ? deathSaves.history.filter((entry): entry is "success" | "failure" => entry === "success" || entry === "failure").slice(-3)
        : []
    }
  };
}

function normalizeStoredStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter(Boolean);
}

function normalizeStoredAbilityKeys(value: unknown): AbilityKey[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value.filter(
        (entry): entry is AbilityKey =>
          entry === "str" || entry === "dex" || entry === "con" || entry === "int" || entry === "wis" || entry === "cha"
      )
    )
  );
}

function normalizeStoredTokenStatusArray(value: unknown): ActorSheet["conditions"] {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowed = new Set<string>(TOKEN_STATUS_MARKERS);
  return Array.from(
    new Set(
      value.filter((entry): entry is ActorSheet["conditions"][number] => typeof entry === "string" && allowed.has(entry))
    )
  );
}
