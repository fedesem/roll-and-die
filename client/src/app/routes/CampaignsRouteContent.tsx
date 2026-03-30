import { CampaignsPage } from "../../pages/CampaignsPage";
import type { CampaignsRouteProps } from "../routeContentTypes";

export function CampaignsRouteContent({ campaigns, navigation }: CampaignsRouteProps) {
  return (
    <CampaignsPage
      campaigns={campaigns}
      onOpenCampaign={(campaignId) => navigation.setSelectedCampaignId(campaignId)}
      onOpenCreateCampaign={() => void navigation.navigate({ name: "campaignCreate" })}
      onOpenJoinCampaign={() => void navigation.navigate({ name: "campaignJoin" })}
    />
  );
}
