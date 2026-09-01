import type {
  ClassEntry,
  CompendiumBackgroundEntry,
  CompendiumItemEntry,
  CompendiumOptionalFeatureEntry,
  CompendiumReferenceEntry,
  CompendiumSpeciesEntry,
  FeatEntry,
  MonsterTemplate,
  SpellEntry
} from "@shared/types";
import type { ReactNode } from "react";

export interface RulesLookupData {
  spellEntries?: Array<SpellEntry | Omit<SpellEntry, "id">>;
  featEntries?: Array<FeatEntry | Omit<FeatEntry, "id">>;
  classEntries?: Array<ClassEntry | Omit<ClassEntry, "id">>;
  variantRuleEntries?: Array<CompendiumReferenceEntry | Omit<CompendiumReferenceEntry, "id">>;
  conditionEntries?: Array<CompendiumReferenceEntry | Omit<CompendiumReferenceEntry, "id">>;
  actionEntries?: Array<CompendiumReferenceEntry | Omit<CompendiumReferenceEntry, "id">>;
  itemEntries?: Array<CompendiumItemEntry | Omit<CompendiumItemEntry, "id">>;
  optionalFeatureEntries?: Array<CompendiumOptionalFeatureEntry | Omit<CompendiumOptionalFeatureEntry, "id">>;
  languageEntries?: Array<CompendiumReferenceEntry | Omit<CompendiumReferenceEntry, "id">>;
  skillEntries?: Array<CompendiumReferenceEntry | Omit<CompendiumReferenceEntry, "id">>;
  raceEntries?: Array<
    CompendiumSpeciesEntry | CompendiumReferenceEntry | Omit<CompendiumSpeciesEntry, "id"> | Omit<CompendiumReferenceEntry, "id">
  >;
  backgroundEntries?: Array<
    CompendiumBackgroundEntry | CompendiumReferenceEntry | Omit<CompendiumBackgroundEntry, "id"> | Omit<CompendiumReferenceEntry, "id">
  >;
  monsterEntries?: Array<MonsterTemplate | Omit<MonsterTemplate, "id">>;
}

export interface PreviewFrameProps {
  eyebrow: string;
  title: string;
  source?: string;
  sourceTitle?: string;
  subtitle?: string;
  children: ReactNode;
}

export interface ClassPreviewFeatureItem {
  key: string;
  kind: "class" | "subclass";
  level: number;
  name: string;
  description: string;
  subclassName?: string;
}
