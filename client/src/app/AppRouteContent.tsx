import { CampaignRouteProvider } from "./CampaignRouteContext";
import { AdminRouteContent } from "./routes/AdminRouteContent";
import { CampaignBoardRouteContent } from "./routes/CampaignBoardRouteContent";
import { CampaignCreateRouteContent } from "./routes/CampaignCreateRouteContent";
import { CampaignHubRouteContent } from "./routes/CampaignHubRouteContent";
import { CampaignJoinRouteContent } from "./routes/CampaignJoinRouteContent";
import { CampaignLoadingRouteContent } from "./routes/CampaignLoadingRouteContent";
import { CampaignsRouteContent } from "./routes/CampaignsRouteContent";
import type { AppRouteContentProps } from "./routeContentTypes";

export function AppRouteContent({
  route,
  roomStatus,
  selectedCampaignId,
  campaignsRoute,
  campaignCreateRoute,
  campaignJoinRoute,
  adminRoute,
  campaignRoute
}: AppRouteContentProps) {
  if (route.name === "admin") {
    return <AdminRouteContent {...adminRoute} />;
  }

  if (route.name === "campaignCreate") {
    return <CampaignCreateRouteContent {...campaignCreateRoute} />;
  }

  if (route.name === "campaignJoin") {
    return <CampaignJoinRouteContent {...campaignJoinRoute} />;
  }

  if (route.name === "campaigns" || !selectedCampaignId) {
    return <CampaignsRouteContent {...campaignsRoute} />;
  }

  const isCampaignRoute = route.name === "campaign" || route.name === "campaignBoard";

  if (!isCampaignRoute || !campaignRoute) {
    return <CampaignLoadingRouteContent roomStatus={roomStatus} />;
  }

  return (
    <CampaignRouteProvider value={campaignRoute}>
      {route.name === "campaign" ? <CampaignHubRouteContent /> : <CampaignBoardRouteContent />}
    </CampaignRouteProvider>
  );
}
