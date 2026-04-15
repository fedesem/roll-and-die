import { addColumnIfMissing, readAll, readCount, tableExists } from "../helpers.js";
import type { Migration } from "../types.js";

interface LegacyClassFeatureEntry {
  level?: number;
  name?: string;
  description?: string;
  source?: string;
  reference?: string;
}

interface LegacySubclassEntry {
  id?: string;
  name?: string;
  shortName?: string;
  source?: string;
  className?: string;
  classSource?: string;
  description?: string;
  features?: LegacyClassFeatureEntry[];
}

interface StoredPlayerNpcBuildClassEntry {
  id?: string;
  subclassId?: string;
  subclassName?: string;
  subclassSource?: string;
}

interface StoredPlayerNpcBuild {
  classes?: StoredPlayerNpcBuildClassEntry[];
}

export const classSubclassStructureMigration: Migration = {
  version: 135,
  name: "class_subclass_structure",
  async up(database) {
    if (await tableExists(database, "actor_classes")) {
      await addColumnIfMissing(database, "actor_classes", "subclass_id", "TEXT NOT NULL DEFAULT ''");
      await addColumnIfMissing(database, "actor_classes", "subclass_name", "TEXT NOT NULL DEFAULT ''");
      await addColumnIfMissing(database, "actor_classes", "subclass_source", "TEXT NOT NULL DEFAULT ''");
    }

    if (await tableExists(database, "compendium_classes")) {
      await database.exec(`
        CREATE TABLE IF NOT EXISTS compendium_class_subclasses (
          class_id TEXT NOT NULL REFERENCES compendium_classes(id) ON DELETE CASCADE,
          id TEXT NOT NULL,
          sort_order INTEGER NOT NULL,
          name TEXT NOT NULL,
          short_name TEXT NOT NULL,
          source TEXT NOT NULL,
          class_name TEXT NOT NULL,
          class_source TEXT NOT NULL,
          description TEXT NOT NULL,
          PRIMARY KEY (class_id, id)
        );

        CREATE TABLE IF NOT EXISTS compendium_class_subclass_features (
          class_id TEXT NOT NULL,
          subclass_id TEXT NOT NULL,
          sort_order INTEGER NOT NULL,
          level INTEGER NOT NULL,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          source TEXT NOT NULL,
          reference TEXT NOT NULL,
          PRIMARY KEY (class_id, subclass_id, sort_order),
          FOREIGN KEY (class_id, subclass_id) REFERENCES compendium_class_subclasses(class_id, id) ON DELETE CASCADE
        );
      `);
    }

    if ((await tableExists(database, "actor_classes")) && (await tableExists(database, "actors"))) {
      const updateActorClassSubclass = database.prepare(`
        UPDATE actor_classes
        SET subclass_id = ?, subclass_name = ?, subclass_source = ?
        WHERE actor_id = ? AND id = ?
      `);

      const actorClassRows = await readAll<{
        actorId: string;
        actorClassId: string;
        buildJson: string;
      }>(
        database,
        `
          SELECT
            actor_classes.actor_id as actorId,
            actor_classes.id as actorClassId,
            actors.build_json as buildJson
          FROM actor_classes
          INNER JOIN actors ON actors.id = actor_classes.actor_id
          WHERE COALESCE(actor_classes.subclass_id, '') = ''
          ORDER BY actor_classes.actor_id, actor_classes.sort_order, actor_classes.id
        `
      );

      actorClassRows.forEach((row) => {
        const build = parseJsonObject<StoredPlayerNpcBuild>(row.buildJson);
        const buildClass = build?.classes?.find((entry) => entry?.id === row.actorClassId);

        if (!buildClass?.subclassId) {
          return;
        }

        updateActorClassSubclass.run(
          String(buildClass.subclassId ?? ""),
          String(buildClass.subclassName ?? ""),
          String(buildClass.subclassSource ?? ""),
          row.actorId,
          row.actorClassId
        );
      });
    }

    if (
      (await tableExists(database, "compendium_classes")) &&
      (await tableExists(database, "compendium_class_subclasses")) &&
      (await tableExists(database, "compendium_class_subclass_features")) &&
      (await readCount(database, "compendium_class_subclasses")) === 0
    ) {
      const classRows = await readAll<{
        id: string;
        name: string;
        source: string;
        subclassesJson: string;
      }>(
        database,
        `
          SELECT
            id,
            name,
            source,
            subclasses_json as subclassesJson
          FROM compendium_classes
          ORDER BY sort_order, name, id
        `
      );

      const insertSubclass = database.prepare(`
        INSERT INTO compendium_class_subclasses (
          class_id, id, sort_order, name, short_name, source, class_name, class_source, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertSubclassFeature = database.prepare(`
        INSERT INTO compendium_class_subclass_features (
          class_id, subclass_id, sort_order, level, name, description, source, reference
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      classRows.forEach((row) => {
        parseJsonArray<LegacySubclassEntry>(row.subclassesJson).forEach((subclass, subclassIndex) => {
          const subclassId = String(subclass.id ?? "").trim();
          const subclassName = String(subclass.name ?? "").trim();
          const subclassSource = String(subclass.source ?? "").trim();

          if (!subclassId || !subclassName) {
            return;
          }

          insertSubclass.run(
            row.id,
            subclassId,
            subclassIndex,
            subclassName,
            String(subclass.shortName ?? "").trim() || subclassName,
            subclassSource,
            String(subclass.className ?? "").trim() || row.name,
            String(subclass.classSource ?? "").trim() || row.source,
            String(subclass.description ?? "").trim()
          );

          normalizeFeatureEntries(subclass.features).forEach((feature, featureIndex) => {
            const featureName = String(feature.name ?? "").trim();

            if (!featureName) {
              return;
            }

            insertSubclassFeature.run(
              row.id,
              subclassId,
              featureIndex,
              typeof feature.level === "number" && Number.isFinite(feature.level) ? feature.level : 1,
              featureName,
              String(feature.description ?? "").trim(),
              String(feature.source ?? "").trim(),
              String(feature.reference ?? "").trim()
            );
          });
        });
      });
    }
  }
};

function parseJsonArray<T>(raw: string) {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function parseJsonObject<T>(raw: string) {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as T) : null;
  } catch {
    return null;
  }
}

function normalizeFeatureEntries(value: unknown) {
  return Array.isArray(value) ? (value as LegacyClassFeatureEntry[]) : [];
}
