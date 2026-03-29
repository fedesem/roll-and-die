import type { RouterHistory } from "@tanstack/history";
import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";

import App from "./App";

function EmptyRoute() {
  return null;
}

const rootRoute = createRootRoute({
  component: App
});

const campaignsIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: EmptyRoute
});

const campaignsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/campaigns",
  component: EmptyRoute
});

const campaignCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/campaigns/new",
  component: EmptyRoute
});

const campaignJoinRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/join",
  component: EmptyRoute
});

const campaignJoinCodeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/join/$code",
  component: EmptyRoute
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: EmptyRoute
});

const campaignRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/campaign/$campaignId",
  component: EmptyRoute
});

const campaignBoardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/campaign/$campaignId/board",
  component: EmptyRoute
});

const routeTree = rootRoute.addChildren([
  campaignsIndexRoute,
  campaignsRoute,
  campaignCreateRoute,
  campaignJoinRoute,
  campaignJoinCodeRoute,
  adminRoute,
  campaignRoute,
  campaignBoardRoute
]);

export function createAppRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    history
  });
}

export const appRouter = createAppRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof appRouter;
  }
}
