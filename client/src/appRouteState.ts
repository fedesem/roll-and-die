import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback } from "react";

export type AppRoute =
  | { name: "campaigns" }
  | { name: "campaignCreate" }
  | { name: "campaignJoin"; code?: string }
  | { name: "admin" }
  | { name: "campaign"; campaignId: string }
  | { name: "campaignBoard"; campaignId: string }
  | { name: "campaignCharacters"; campaignId: string }
  | { name: "campaignCharacterEdit"; campaignId: string; actorId: string }
  | { name: "campaignCharacterLevelUp"; campaignId: string; actorId: string };

export function parseAppRoute(pathname: string): AppRoute {
  if (pathname === "/" || pathname === "/campaigns") {
    return { name: "campaigns" };
  }

  if (pathname === "/campaigns/new") {
    return { name: "campaignCreate" };
  }

  if (pathname === "/join") {
    return { name: "campaignJoin" };
  }

  const joinMatch = pathname.match(/^\/join\/([^/]+)$/);

  if (joinMatch?.[1]) {
    return { name: "campaignJoin", code: decodeURIComponent(joinMatch[1]) };
  }

  if (pathname === "/admin") {
    return { name: "admin" };
  }

  const characterEditMatch = pathname.match(/^\/campaign\/([^/]+)\/characters\/([^/]+)\/edit$/);
  if (characterEditMatch?.[1] && characterEditMatch?.[2]) {
    return {
      name: "campaignCharacterEdit",
      campaignId: decodeURIComponent(characterEditMatch[1]),
      actorId: decodeURIComponent(characterEditMatch[2])
    };
  }

  const characterLevelUpMatch = pathname.match(/^\/campaign\/([^/]+)\/characters\/([^/]+)\/level-up$/);
  if (characterLevelUpMatch?.[1] && characterLevelUpMatch?.[2]) {
    return {
      name: "campaignCharacterLevelUp",
      campaignId: decodeURIComponent(characterLevelUpMatch[1]),
      actorId: decodeURIComponent(characterLevelUpMatch[2])
    };
  }

  const charactersMatch = pathname.match(/^\/campaign\/([^/]+)\/characters$/);
  if (charactersMatch?.[1]) {
    return {
      name: "campaignCharacters",
      campaignId: decodeURIComponent(charactersMatch[1])
    };
  }

  const boardMatch = pathname.match(/^\/campaign\/([^/]+)\/board$/);

  if (boardMatch?.[1]) {
    return { name: "campaignBoard", campaignId: decodeURIComponent(boardMatch[1]) };
  }

  const match = pathname.match(/^\/campaign\/([^/]+)$/);

  if (match?.[1]) {
    return { name: "campaign", campaignId: decodeURIComponent(match[1]) };
  }

  return { name: "campaigns" };
}

export function appRouteToPath(route: AppRoute) {
  if (route.name === "campaign") {
    return `/campaign/${encodeURIComponent(route.campaignId)}`;
  }

  if (route.name === "campaignBoard") {
    return `/campaign/${encodeURIComponent(route.campaignId)}/board`;
  }

  if (route.name === "campaignCharacters") {
    return `/campaign/${encodeURIComponent(route.campaignId)}/characters`;
  }

  if (route.name === "campaignCharacterEdit") {
    return `/campaign/${encodeURIComponent(route.campaignId)}/characters/${encodeURIComponent(route.actorId)}/edit`;
  }

  if (route.name === "campaignCharacterLevelUp") {
    return `/campaign/${encodeURIComponent(route.campaignId)}/characters/${encodeURIComponent(route.actorId)}/level-up`;
  }

  if (route.name === "campaignCreate") {
    return "/campaigns/new";
  }

  if (route.name === "campaignJoin") {
    return route.code ? `/join/${encodeURIComponent(route.code)}` : "/join";
  }

  if (route.name === "admin") {
    return "/admin";
  }

  return "/campaigns";
}

export function useAppRoute() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname
  });
  const route = parseAppRoute(pathname);
  const navigateTo = useNavigate();

  const navigate = useCallback(
    (nextRoute: AppRoute, options?: { replace?: boolean }) => {
      return navigateTo({
        to: appRouteToPath(nextRoute),
        replace: options?.replace
      });
    },
    [navigateTo]
  );

  return { route, navigate };
}
