import { lazy, Suspense } from "react";
import { useCampaignRouteContext } from "../CampaignRouteContext";
import { RouteChunkFallback } from "../RouteChunkFallback";
import type { AppNavigation } from "../routeContentTypes";

const CharacterEditPage = lazy(async () => {
  const module = await import("../../pages/CharacterEditPage");
  return { default: module.CharacterEditPage };
});

export function CharacterEditRouteContent({ actorId, navigation }: { actorId: string; navigation: AppNavigation }) {
  const { hubPageProps } = useCampaignRouteContext();
  const actor = hubPageProps.campaign.actors.find((a) => a.id === actorId);

  if (!actor) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4 text-center">
        <h2 className="font-serif text-2xl font-bold text-amber-100">Character Not Found</h2>
        <p className="text-sm text-zinc-400">The character with ID &ldquo;{actorId}&rdquo; was not found in this campaign.</p>
        <button
          type="button"
          onClick={navigation.openCampaignHome}
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-200"
        >
          Back to Campaign
        </button>
      </div>
    );
  }

  return (
    <Suspense fallback={<RouteChunkFallback />}>
      <CharacterEditPage
        token={hubPageProps.token}
        actor={actor}
        compendium={hubPageProps.compendium}
        allowedSourceBooks={hubPageProps.campaign.allowedSourceBooks}
        role={hubPageProps.role}
        currentUserId={hubPageProps.currentUserId}
        onBack={navigation.openCampaignHome}
        onSave={hubPageProps.onSaveActor}
        onRoll={(notation, label) => hubPageProps.onRoll(notation, label, actor)}
      />
    </Suspense>
  );
}
