import { Shield } from "lucide-react";

import type { MemberRole } from "@shared/types";

import type { RoomStatus } from "../services/roomConnection";

interface AppTopbarProps {
  userName: string;
  isAdmin: boolean;
  isAdminRoute: boolean;
  campaignName?: string;
  activeMapName?: string;
  role?: MemberRole;
  roomStatus?: RoomStatus;
  showRoomStatus: boolean;
  onOpenAdmin: () => void;
  onOpenCampaigns: () => void;
  onLogout: () => void;
}

export function AppTopbar({
  userName,
  isAdmin,
  isAdminRoute,
  campaignName,
  activeMapName,
  role,
  roomStatus,
  showRoomStatus,
  onOpenAdmin,
  onOpenCampaigns,
  onLogout
}: AppTopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <p className="eyebrow">Logged in as {userName}</p>
        <h1>DnD 2024 Board</h1>
      </div>
      {showRoomStatus && campaignName && role && roomStatus && (
        <div className="topbar-room-status">
          <span className="status-chip status-title">{campaignName}</span>
          <span className="status-chip">{activeMapName ?? "No map"}</span>
          <span className="status-chip">{role.toUpperCase()}</span>
          <span className={`status-chip status-${roomStatus}`}>{roomStatus}</span>
        </div>
      )}
      <div className="topbar-actions">
        {isAdmin && (
          <button type="button" className={isAdminRoute ? "accent-button" : ""} onClick={onOpenAdmin}>
            <Shield size={15} />
            <span>Admin</span>
          </button>
        )}
        <button type="button" onClick={onOpenCampaigns}>
          Campaigns
        </button>
        <button type="button" onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
