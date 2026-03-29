import { useEffect, useState } from "react";

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryHistory } from "@tanstack/history";
import { RouterProvider, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";

import { useAppRoute } from "../src/appRouteState";

type TestSession = {
  token: string;
  user: {
    id: string;
    name: string;
    isAdmin: boolean;
  };
};

interface RouterHarnessProps {
  initialSession: TestSession | null;
  loginSession: TestSession;
  onAcceptInvite: (code?: string) => Promise<void>;
}

function RouterHarness({ initialSession, loginSession, onAcceptInvite }: RouterHarnessProps) {
  const { route, navigate } = useAppRoute();
  const [session, setSession] = useState<TestSession | null>(initialSession);
  const [joinCode, setJoinCode] = useState("");
  const [inviteLinkConsumed, setInviteLinkConsumed] = useState<string | null>(null);

  useEffect(() => {
    if (route.name === "admin" && session && !session.user.isAdmin) {
      void navigate({ name: "campaigns" }, { replace: true });
    }
  }, [navigate, route.name, session]);

  useEffect(() => {
    if (!session?.token || route.name !== "campaignJoin" || !route.code || inviteLinkConsumed === route.code) {
      return;
    }

    setInviteLinkConsumed(route.code);
    setJoinCode(route.code);
    void onAcceptInvite(route.code);
  }, [inviteLinkConsumed, onAcceptInvite, route, session?.token]);

  if (!session) {
    return (
      <form
        aria-label="auth-form"
        onSubmit={(event) => {
          event.preventDefault();
          setSession(loginSession);
        }}
      >
        <button type="submit">Log in</button>
      </form>
    );
  }

  if (route.name === "campaignJoin") {
    return (
      <main>
        <h1>Join page</h1>
        <p>{`Join code: ${joinCode}`}</p>
      </main>
    );
  }

  if (route.name === "admin") {
    return <h1>Admin panel</h1>;
  }

  if (route.name === "campaign") {
    return (
      <main>
        <h1>Campaign hub</h1>
        <button
          type="button"
          onClick={() => {
            void navigate({ name: "campaignBoard", campaignId: route.campaignId });
          }}
        >
          Open board
        </button>
      </main>
    );
  }

  if (route.name === "campaignBoard") {
    return <h1>Campaign board</h1>;
  }

  if (route.name === "campaignCreate") {
    return <h1>Create campaign</h1>;
  }

  return <h1>Campaigns page</h1>;
}

function EmptyRoute() {
  return null;
}

function createHarnessRouter(history = createMemoryHistory({ initialEntries: ["/"] }), props: RouterHarnessProps) {
  const rootRoute = createRootRoute({
    component: () => <RouterHarness {...props} />
  });

  const routeTree = rootRoute.addChildren([
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/",
      component: EmptyRoute
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/campaigns",
      component: EmptyRoute
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/campaigns/new",
      component: EmptyRoute
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/join",
      component: EmptyRoute
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/join/$code",
      component: EmptyRoute
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/admin",
      component: EmptyRoute
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/campaign/$campaignId",
      component: EmptyRoute
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/campaign/$campaignId/board",
      component: EmptyRoute
    })
  ]);

  return createRouter({
    routeTree,
    history
  });
}

function renderHarness(initialEntries: string[], props?: Partial<RouterHarnessProps>) {
  const history = createMemoryHistory({ initialEntries });
  const acceptInvite = props?.onAcceptInvite ?? vi.fn(async (_code?: string) => undefined);
  const router = createHarnessRouter(history, {
    initialSession: props?.initialSession ?? null,
    loginSession:
      props?.loginSession ??
      ({
        token: "token-user",
        user: {
          id: "user-1",
          name: "Fede",
          isAdmin: false
        }
      } satisfies TestSession),
    onAcceptInvite: acceptInvite
  });
  const user = userEvent.setup();

  render(<RouterProvider router={router} />);

  return { history, acceptInvite, user };
}

afterEach(() => {
  cleanup();
});

describe("router flows", () => {
  it("navigates from login to campaigns", async () => {
    const { history, user } = renderHarness(["/"]);

    await user.click(await screen.findByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("heading", { name: "Campaigns page" })).not.toBeNull();
    expect(history.location.pathname).toBe("/");
  });

  it("consumes invite links on the join route", async () => {
    const session = {
      token: "token-user",
      user: {
        id: "user-1",
        name: "Fede",
        isAdmin: false
      }
    } satisfies TestSession;

    const { acceptInvite } = renderHarness(["/join/invite-42"], {
      initialSession: session,
      loginSession: session
    });

    expect(await screen.findByRole("heading", { name: "Join page" })).not.toBeNull();
    await waitFor(() => {
      expect(acceptInvite).toHaveBeenCalledWith("invite-42");
    });
    expect(screen.getByText("Join code: invite-42")).not.toBeNull();
  });

  it("redirects non-admin users away from the admin route", async () => {
    const session = {
      token: "token-user",
      user: {
        id: "user-1",
        name: "Fede",
        isAdmin: false
      }
    } satisfies TestSession;

    const { history } = renderHarness(["/admin"], {
      initialSession: session,
      loginSession: session
    });

    await waitFor(() => {
      expect(history.location.pathname).toBe("/campaigns");
    });
    expect(await screen.findByRole("heading", { name: "Campaigns page" })).not.toBeNull();
    expect(screen.queryByText("Admin panel")).toBeNull();
  });

  it("moves from the campaign hub route to the board route", async () => {
    const session = {
      token: "token-dm",
      user: {
        id: "dm-1",
        name: "Dungeon Master",
        isAdmin: true
      }
    } satisfies TestSession;

    const { history, user } = renderHarness(["/campaign/c1"], {
      initialSession: session,
      loginSession: session
    });

    expect(await screen.findByRole("heading", { name: "Campaign hub" })).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Open board" }));

    await waitFor(() => {
      expect(history.location.pathname).toBe("/campaign/c1/board");
    });
    expect(await screen.findByRole("heading", { name: "Campaign board" })).not.toBeNull();
  });
});
