import { useCallback } from "react";

import type { AppRoute } from "../appRouteState";
import type {
  AdminRouteProps,
  AppNavigation,
  CampaignCreateRouteProps,
  CampaignJoinRouteProps,
  CampaignsRouteProps
} from "./routeContentTypes";
import type { CampaignSourceBook, CampaignSummary } from "@shared/types";

interface UseStaticRouteModelsOptions {
  route: AppRoute;
  campaigns: CampaignSummary[];
  campaignSourceBooks: CampaignSourceBook[];
  createCampaignName: string;
  createCampaignAllowedSourceBooks: string[];
  joinCode: string;
  token?: string;
  currentUserId?: string;
  navigation: AppNavigation;
  setBanner: (value: { tone: "info" | "error"; text: string } | null) => void;
  refreshCampaignSourceBooks: () => Promise<CampaignSourceBook[]>;
  setCreateCampaignName: (value: string) => void;
  setCreateCampaignAllowedSourceBooks: (value: string[]) => void;
  setJoinCode: (value: string) => void;
  createCampaign: () => Promise<void>;
  acceptInvite: (code?: string) => Promise<void>;
}

export function useStaticRouteModels({
  route,
  campaigns,
  campaignSourceBooks,
  createCampaignName,
  createCampaignAllowedSourceBooks,
  joinCode,
  token,
  currentUserId,
  navigation,
  setBanner,
  refreshCampaignSourceBooks,
  setCreateCampaignName,
  setCreateCampaignAllowedSourceBooks,
  setJoinCode,
  createCampaign,
  acceptInvite
}: UseStaticRouteModelsOptions) {
  const handleRefreshSourceBooks = useCallback(async () => {
    await refreshCampaignSourceBooks();
  }, [refreshCampaignSourceBooks]);

  const handleAcceptInvite = useCallback(() => acceptInvite(), [acceptInvite]);

  const campaignsRoute: CampaignsRouteProps = {
    campaigns,
    navigation
  };

  const campaignCreateRoute: CampaignCreateRouteProps = {
    campaignSourceBooks,
    createCampaignName,
    createCampaignAllowedSourceBooks,
    navigation,
    onCreateCampaignNameChange: setCreateCampaignName,
    onCreateCampaignAllowedSourceBooksChange: setCreateCampaignAllowedSourceBooks,
    onCreateCampaign: createCampaign
  };

  const campaignJoinRoute: CampaignJoinRouteProps = {
    route: route.name === "campaignJoin" ? route : { name: "campaignJoin" },
    joinCode,
    navigation,
    onJoinCodeChange: setJoinCode,
    onAcceptInvite: handleAcceptInvite
  };

  const adminRoute: AdminRouteProps = {
    token: token ?? "",
    currentUserId: currentUserId ?? "",
    onStatus: (tone, text) => setBanner({ tone, text }),
    onRefreshSourceBooks: handleRefreshSourceBooks
  };

  return {
    campaignsRoute,
    campaignCreateRoute,
    campaignJoinRoute,
    adminRoute
  };
}
