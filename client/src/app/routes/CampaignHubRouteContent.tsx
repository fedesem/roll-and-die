import { lazy, Suspense } from "react";

import { useCampaignRouteContext } from "../CampaignRouteContext";
import { RouteChunkFallback } from "../RouteChunkFallback";

const CampaignHubPage = lazy(async () => {
  const module = await import("../../pages/CampaignHubPage");
  return { default: module.CampaignHubPage };
});

export function CampaignHubRouteContent() {
  const { hubPageProps } = useCampaignRouteContext();

  return (
    <Suspense fallback={<RouteChunkFallback />}>
      <CampaignHubPage {...hubPageProps} />
    </Suspense>
  );
}
