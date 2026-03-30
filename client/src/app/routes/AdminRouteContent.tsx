import { lazy, Suspense } from "react";

import { RouteChunkFallback } from "../RouteChunkFallback";
import type { AdminRouteProps } from "../routeContentTypes";

const AdminPanel = lazy(async () => {
  const module = await import("../../components/AdminPanel");
  return { default: module.AdminPanel };
});

export function AdminRouteContent({ token, currentUserId, onStatus, onRefreshSourceBooks }: AdminRouteProps) {
  return (
    <Suspense fallback={<RouteChunkFallback />}>
      <AdminPanel token={token} currentUserId={currentUserId} onStatus={onStatus} onRefreshSourceBooks={onRefreshSourceBooks} />
    </Suspense>
  );
}
