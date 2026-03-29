import { useCallback } from "react";

import type { CompendiumData } from "@shared/types";

import {
  clearCompendiumItems,
  createCompendiumItem,
  deleteAdminUser,
  deleteCompendiumItem,
  demoteAdminUser,
  importCompendiumItems,
  importMonsterTokenArchive,
  promoteAdminUser
} from "./adminService";
import { uploadImageAsset } from "../../services/assetService";

type CompendiumTab = keyof CompendiumData;

interface UseAdminPanelActionsOptions {
  token: string;
}

export function useAdminPanelActions({ token }: UseAdminPanelActionsOptions) {
  const promoteUser = useCallback((userId: string) => promoteAdminUser(token, userId), [token]);
  const demoteUser = useCallback((userId: string) => demoteAdminUser(token, userId), [token]);
  const deleteUser = useCallback((userId: string) => deleteAdminUser(token, userId), [token]);
  const createItem = useCallback((kind: CompendiumTab, entry: unknown) => createCompendiumItem(token, kind, entry), [token]);
  const importItems = useCallback((kind: CompendiumTab, entries: unknown) => importCompendiumItems(token, kind, entries), [token]);
  const deleteItem = useCallback((kind: CompendiumTab, itemId: string) => deleteCompendiumItem(token, kind, itemId), [token]);
  const clearItems = useCallback((kind: CompendiumTab) => clearCompendiumItems(token, kind), [token]);
  const uploadTokenImage = useCallback((file: File) => uploadImageAsset(token, "tokens", file), [token]);
  const importTokenArchive = useCallback((file: File) => importMonsterTokenArchive(token, file), [token]);

  return {
    promoteUser,
    demoteUser,
    deleteUser,
    createItem,
    importItems,
    deleteItem,
    clearItems,
    uploadTokenImage,
    importTokenArchive
  };
}
