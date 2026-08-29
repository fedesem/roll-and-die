import { lazy, Suspense } from "react";
import { useCampaignRouteContext } from "../CampaignRouteContext";
import { RouteChunkFallback } from "../RouteChunkFallback";
import type { AppNavigation } from "../routeContentTypes";

const CampaignCharactersPage = lazy(async () => {
  const module = await import("../../pages/CampaignCharactersPage");
  return { default: module.CampaignCharactersPage };
});

export function CampaignCharactersRouteContent({ navigation }: { navigation: AppNavigation }) {
  const { hubPageProps } = useCampaignRouteContext();

  return (
    <Suspense fallback={<RouteChunkFallback />}>
      <CampaignCharactersPage
        token={hubPageProps.token}
        campaign={hubPageProps.campaign}
        compendium={hubPageProps.compendium}
        role={hubPageProps.role}
        currentUserId={hubPageProps.currentUserId}
        onOpenBoard={navigation.openCampaignBoard}
        onOpenEdit={navigation.openCharacterEdit}
        onOpenLevelUp={navigation.openCharacterLevelUp}
        onCreateCharacter={hubPageProps.onCreateActor}
        onDeleteCharacter={hubPageProps.onDeleteActor}
        onRoll={hubPageProps.onRoll}
        onSaveActor={hubPageProps.onSaveActor}
      />
    </Suspense>
  );
}
