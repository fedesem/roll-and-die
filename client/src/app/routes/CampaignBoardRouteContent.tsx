import { lazy, Suspense } from "react";

import { BoardFloatingChatPortal } from "../../features/campaign/BoardFloatingChatPortal";
import { useCampaignRouteContext } from "../CampaignRouteContext";
import { RouteChunkFallback } from "../RouteChunkFallback";

const CampaignPage = lazy(async () => {
  const module = await import("../../pages/CampaignPage");
  return { default: module.CampaignPage };
});

export function CampaignBoardRouteContent() {
  const { boardPageProps } = useCampaignRouteContext();

  return (
    <>
      <Suspense fallback={<RouteChunkFallback />}>
        <CampaignPage {...boardPageProps} />
      </Suspense>
      {boardPageProps.activePopup === "sheet" ? (
        <BoardFloatingChatPortal
          messages={boardPageProps.campaign.chat}
          currentUserId={boardPageProps.currentUserId}
          onSend={boardPageProps.onSendChat}
        />
      ) : null}
    </>
  );
}
