import type { AdminOverview, CompendiumData } from "@shared/types";

import { apiRequest } from "../../api";

type CompendiumTab = keyof CompendiumData;

export function fetchAdminOverview(token: string) {
  return apiRequest<AdminOverview>("/admin/overview", { token });
}

export function promoteAdminUser(token: string, userId: string) {
  return apiRequest(`/admin/users/${userId}/promote`, {
    method: "POST",
    token
  });
}

export function demoteAdminUser(token: string, userId: string) {
  return apiRequest(`/admin/users/${userId}/demote`, {
    method: "POST",
    token
  });
}

export function createCompendiumItem(token: string, kind: CompendiumTab, entry: unknown) {
  return apiRequest<{ id: string }>(`/admin/compendium/${kind}`, {
    method: "POST",
    token,
    body: entry
  });
}

export function importCompendiumItems(token: string, kind: CompendiumTab, entries: unknown) {
  return apiRequest(`/admin/compendium/${kind}/import`, {
    method: "POST",
    token,
    body: { entries }
  });
}
