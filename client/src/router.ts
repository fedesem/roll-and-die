import { useCallback, useEffect, useState } from "react";

export type AppRoute =
  | { name: "campaigns" }
  | { name: "campaignCreate" }
  | { name: "campaignJoin"; code?: string }
  | { name: "admin" }
  | { name: "campaign"; campaignId: string };

function parseRoute(pathname: string): AppRoute {
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

  const match = pathname.match(/^\/campaign\/([^/]+)$/);

  if (match?.[1]) {
    return { name: "campaign", campaignId: decodeURIComponent(match[1]) };
  }
  return { name: "campaigns" };
}

function routeToPath(route: AppRoute) {
  if (route.name === "campaign") {
    return `/campaign/${encodeURIComponent(route.campaignId)}`;
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

export function useAppRouter() {
  const [route, setRoute] = useState<AppRoute>(() => parseRoute(window.location.pathname));

  useEffect(() => {
    const handlePopState = () => {
      setRoute(parseRoute(window.location.pathname));
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const navigate = useCallback((nextRoute: AppRoute, options?: { replace?: boolean }) => {
    const nextPath = routeToPath(nextRoute);

    if (window.location.pathname !== nextPath) {
      const method = options?.replace ? "replaceState" : "pushState";
      window.history[method]({}, "", nextPath);
    }

    setRoute(nextRoute);
  }, []);

  return { route, navigate };
}
