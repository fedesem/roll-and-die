import { useEffect, useState } from "react";

export type AppRoute = { name: "home" } | { name: "admin" } | { name: "campaign"; campaignId: string };

function parseRoute(pathname: string): AppRoute {
  if (pathname === "/admin") {
    return { name: "admin" };
  }

  const match = pathname.match(/^\/campaign\/([^/]+)$/);

  if (match?.[1]) {
    return { name: "campaign", campaignId: decodeURIComponent(match[1]) };
  }

  return { name: "home" };
}

function routeToPath(route: AppRoute) {
  if (route.name === "campaign") {
    return `/campaign/${encodeURIComponent(route.campaignId)}`;
  }

  if (route.name === "admin") {
    return "/admin";
  }

  return "/";
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

  function navigate(nextRoute: AppRoute, options?: { replace?: boolean }) {
    const nextPath = routeToPath(nextRoute);

    if (window.location.pathname !== nextPath) {
      const method = options?.replace ? "replaceState" : "pushState";
      window.history[method]({}, "", nextPath);
    }

    setRoute(nextRoute);
  }

  return { route, navigate };
}
