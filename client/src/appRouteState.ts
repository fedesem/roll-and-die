import { useCallback } from "react";

import { useNavigate, useRouterState } from "@tanstack/react-router";

export type AppRoute =
  | { name: "campaigns" }
  | { name: "campaignCreate" }
  | { name: "campaignJoin"; code?: string }
  | { name: "admin" }
  | { name: "campaign"; campaignId: string }
  | { name: "campaignBoard"; campaignId: string };

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
