import { useCallback, useEffect } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { CampaignSummary } from "@shared/types";

import { queryKeys } from "../../lib/queryKeys";
import { toErrorMessage } from "../../lib/errors";
import { fetchCampaigns } from "./campaignService";

interface UseCampaignSummariesQueryOptions {
  token?: string | null;
  onError: (message: string) => void;
}

export function useCampaignSummariesQuery({
  token,
  onError
}: UseCampaignSummariesQueryOptions) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: token ? queryKeys.campaigns(token) : ["campaigns", "anonymous"],
    queryFn: () => fetchCampaigns(token!),
    enabled: Boolean(token),
    staleTime: 30_000
  });

  useEffect(() => {
    if (query.error) {
      onError(toErrorMessage(query.error));
    }
  }, [onError, query.error]);

  const refreshCampaigns = useCallback(async (): Promise<CampaignSummary[]> => {
    if (!token) {
      return [];
    }

    return queryClient.fetchQuery({
      queryKey: queryKeys.campaigns(token),
      queryFn: () => fetchCampaigns(token)
    });
  }, [queryClient, token]);

  return {
    campaigns: query.data ?? [],
    isLoading: query.isPending,
    refreshCampaigns
  };
}
