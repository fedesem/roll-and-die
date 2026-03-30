import { CampaignCreatePage } from "../../pages/CampaignCreatePage";
import type { CampaignCreateRouteProps } from "../routeContentTypes";

export function CampaignCreateRouteContent({
  campaignSourceBooks,
  createCampaignName,
  createCampaignAllowedSourceBooks,
  navigation,
  onCreateCampaignNameChange,
  onCreateCampaignAllowedSourceBooksChange,
  onCreateCampaign
}: CampaignCreateRouteProps) {
  return (
    <CampaignCreatePage
      campaignSourceBooks={campaignSourceBooks}
      createCampaignName={createCampaignName}
      createCampaignAllowedSourceBooks={createCampaignAllowedSourceBooks}
      onCreateCampaignNameChange={onCreateCampaignNameChange}
      onCreateCampaignAllowedSourceBooksChange={onCreateCampaignAllowedSourceBooksChange}
      onCreateCampaign={() => void onCreateCampaign()}
      onBack={() => void navigation.navigate({ name: "campaigns" })}
    />
  );
}
