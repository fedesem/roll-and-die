import { CampaignLoadingPage } from "../../pages/CampaignLoadingPage";
import type { RoomStatus } from "../../services/roomConnection";

interface CampaignLoadingRouteContentProps {
  roomStatus: RoomStatus;
}

export function CampaignLoadingRouteContent({ roomStatus }: CampaignLoadingRouteContentProps) {
  return <CampaignLoadingPage roomStatus={roomStatus} />;
}
