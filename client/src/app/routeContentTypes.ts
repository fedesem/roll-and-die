import type { AppRoute } from "../appRouteState";
import type { CampaignHubPageProps } from "../pages/CampaignHubPage";
import type { CampaignPageProps } from "../pages/CampaignPage";
import type { RoomStatus } from "../services/roomConnection";
import type { CampaignSnapshot, CampaignSourceBook, CampaignSummary } from "@shared/types";

export interface AppSession {
  token: string;
  user: {
    id: string;
    isAdmin: boolean;
  };
}

export interface AppNavigation {
  navigate: (route: AppRoute, options?: { replace?: boolean }) => Promise<void>;
  setSelectedCampaignId: (campaignId: string | null, options?: { replace?: boolean }) => void;
  openCampaignHome: () => void;
  openCampaignBoard: () => void;
}

export interface CampaignsRouteProps {
  campaigns: CampaignSummary[];
  navigation: AppNavigation;
}

export interface CampaignCreateRouteProps {
  campaignSourceBooks: CampaignSourceBook[];
  createCampaignName: string;
  createCampaignAllowedSourceBooks: string[];
  navigation: AppNavigation;
  onCreateCampaignNameChange: (value: string) => void;
  onCreateCampaignAllowedSourceBooksChange: (value: string[]) => void;
  onCreateCampaign: () => Promise<void>;
}

export interface CampaignJoinRouteProps {
  route: Extract<AppRoute, { name: "campaignJoin" }>;
  joinCode: string;
  navigation: AppNavigation;
  onJoinCodeChange: (value: string) => void;
  onAcceptInvite: () => Promise<void>;
}

export interface AdminRouteProps {
  token: string;
  currentUserId: string;
  onStatus: (tone: "info" | "error", text: string) => void;
  onRefreshSourceBooks: () => Promise<void>;
}

export interface CampaignRouteContextValue {
  selectedCampaignId: string;
  snapshot: CampaignSnapshot;
  roomStatus: RoomStatus;
  hubPageProps: CampaignHubPageProps;
  boardPageProps: CampaignPageProps;
}

export interface AppRouteContentProps {
  route: AppRoute;
  roomStatus: RoomStatus;
  selectedCampaignId: string | null;
  campaignsRoute: CampaignsRouteProps;
  campaignCreateRoute: CampaignCreateRouteProps;
  campaignJoinRoute: CampaignJoinRouteProps;
  adminRoute: AdminRouteProps;
  campaignRoute: CampaignRouteContextValue | null;
}
