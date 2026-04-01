import { lazy, Suspense } from "react";

import { useCampaignRouteContext } from "../CampaignRouteContext";
import { RouteChunkFallback } from "../RouteChunkFallback";

const CampaignPage = lazy(async () => {
  const module = await import("../../pages/CampaignPage");
  return { default: module.CampaignPage };
});

export function CampaignBoardRouteContent() {
  const { boardPageProps } = useCampaignRouteContext();

  return (
    <Suspense fallback={<RouteChunkFallback />}>
      <CampaignPage {...boardPageProps} />
    </Suspense>
  );
}
