import { useCallback, useEffect } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "../../lib/queryKeys";
import { toErrorMessage } from "../../lib/errors";
import { fetchAdminOverview } from "./adminService";

interface UseAdminOverviewQueryOptions {
  token: string;
  onError: (message: string) => void;
}

export function useAdminOverviewQuery({ token, onError }: UseAdminOverviewQueryOptions) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.adminOverview(token),
    queryFn: () => fetchAdminOverview(token),
    staleTime: 30_000
  });

  useEffect(() => {
    if (query.error) {
      onError(toErrorMessage(query.error));
    }
  }, [onError, query.error]);

  const refreshOverview = useCallback(() => {
    return queryClient.fetchQuery({
      queryKey: queryKeys.adminOverview(token),
      queryFn: () => fetchAdminOverview(token)
    });
  }, [queryClient, token]);

  return {
    overview: query.data ?? null,
    isLoading: query.isPending,
    refreshOverview
  };
}
