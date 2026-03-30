import { useCallback } from "react";

import type { AppRoute } from "../appRouteState";
import type { AppNavigation } from "./routeContentTypes";

interface UseAppNavigationModelOptions {
  navigate: (route: AppRoute, options?: { replace?: boolean }) => Promise<void>;
  selectedCampaignId: string | null;
  setSelectedCampaignIdState: (campaignId: string | null) => void;
  setActivePopup: (popup: "sheet" | null) => void;
}

export function useAppNavigationModel({
  navigate,
  selectedCampaignId,
  setSelectedCampaignIdState,
  setActivePopup
}: UseAppNavigationModelOptions): AppNavigation {
  const setSelectedCampaignId = useCallback<AppNavigation["setSelectedCampaignId"]>(
    (nextCampaignId, options) => {
      setSelectedCampaignIdState(nextCampaignId);
      void navigate(nextCampaignId ? { name: "campaign", campaignId: nextCampaignId } : { name: "campaigns" }, options);
    },
    [navigate, setSelectedCampaignIdState]
  );

  const openCampaignHome = useCallback(() => {
    if (!selectedCampaignId) {
      return;
    }

    setActivePopup(null);
    void navigate({ name: "campaign", campaignId: selectedCampaignId });
  }, [navigate, selectedCampaignId, setActivePopup]);

  const openCampaignBoard = useCallback(() => {
    if (!selectedCampaignId) {
      return;
    }

    setActivePopup(null);
    void navigate({ name: "campaignBoard", campaignId: selectedCampaignId });
  }, [navigate, selectedCampaignId, setActivePopup]);

  return {
    navigate,
    setSelectedCampaignId,
    openCampaignHome,
    openCampaignBoard
  };
}
