import { useCallback, useEffect } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { CampaignSourceBook, CampaignSummary } from "@shared/types";

import { queryKeys } from "../../lib/queryKeys";
import { toErrorMessage } from "../../lib/errors";
import { fetchCampaignSourceBooks, fetchCampaigns } from "./campaignService";

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
  const sourceBooksQuery = useQuery({
    queryKey: token ? queryKeys.campaignSourceBooks(token) : ["campaignSourceBooks", "anonymous"],
    queryFn: () => fetchCampaignSourceBooks(token!),
    enabled: Boolean(token),
    staleTime: 30_000
  });

  useEffect(() => {
    if (query.error || sourceBooksQuery.error) {
      onError(toErrorMessage(query.error ?? sourceBooksQuery.error));
    }
  }, [onError, query.error, sourceBooksQuery.error]);

  const refreshCampaigns = useCallback(async (): Promise<CampaignSummary[]> => {
    if (!token) {
      return [];
    }

    return queryClient.fetchQuery({
      queryKey: queryKeys.campaigns(token),
      queryFn: () => fetchCampaigns(token)
    });
  }, [queryClient, token]);

  const refreshCampaignSourceBooks = useCallback(async (): Promise<CampaignSourceBook[]> => {
    if (!token) {
      return [];
    }

    return queryClient.fetchQuery({
      queryKey: queryKeys.campaignSourceBooks(token),
      queryFn: () => fetchCampaignSourceBooks(token)
    });
  }, [queryClient, token]);

  return {
    campaigns: query.data ?? [],
    campaignSourceBooks: sourceBooksQuery.data ?? [],
    isLoading: query.isPending,
    refreshCampaigns,
    refreshCampaignSourceBooks
  };
}
