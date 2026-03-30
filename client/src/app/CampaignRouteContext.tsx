import { createContext, useContext, type ReactNode } from "react";

import type { CampaignRouteContextValue } from "./routeContentTypes";

const CampaignRouteContext = createContext<CampaignRouteContextValue | null>(null);

interface CampaignRouteProviderProps {
  value: CampaignRouteContextValue;
  children: ReactNode;
}

export function CampaignRouteProvider({ value, children }: CampaignRouteProviderProps) {
  return <CampaignRouteContext.Provider value={value}>{children}</CampaignRouteContext.Provider>;
}

export function useCampaignRouteContext() {
  const context = useContext(CampaignRouteContext);

  if (!context) {
    throw new Error("useCampaignRouteContext must be used within a CampaignRouteProvider.");
  }

  return context;
}
