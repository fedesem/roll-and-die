import { CampaignJoinPage } from "../../pages/CampaignJoinPage";
import type { CampaignJoinRouteProps } from "../routeContentTypes";

export function CampaignJoinRouteContent({ route, joinCode, navigation, onJoinCodeChange, onAcceptInvite }: CampaignJoinRouteProps) {
  return (
    <CampaignJoinPage
      joinCode={joinCode}
      hasInviteLink={Boolean(route.code)}
      onJoinCodeChange={onJoinCodeChange}
      onAcceptInvite={() => void onAcceptInvite()}
      onBack={() => void navigation.navigate({ name: "campaigns" })}
    />
  );
}
