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
    <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 border-b border-amber-200/10 bg-slate-950/85 px-5 py-3 text-slate-100 backdrop-blur-xl">
      <div className="min-w-0">
        <p className="text-[0.7rem] font-medium uppercase tracking-[0.28em] text-amber-200/55">Logged in as {userName}</p>
        <h1 className="font-serif text-xl tracking-wide text-amber-100">DnD 2024 Board</h1>
      </div>
      {showRoomStatus && campaignName && role && roomStatus && (
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-2">
          <span className="rounded-none border border-amber-300/20 bg-amber-300/12 px-3 py-1 text-xs font-semibold text-amber-100">{campaignName}</span>
          <span className="rounded-none border border-white/10 bg-white/6 px-3 py-1 text-xs text-slate-200">{activeMapName ?? "No map"}</span>
          <span className="rounded-none border border-white/10 bg-white/6 px-3 py-1 text-xs text-slate-200">{role.toUpperCase()}</span>
          <span
            className={`rounded-none border px-3 py-1 text-xs font-medium ${
              roomStatus === "online"
                ? "border-emerald-400/25 bg-emerald-400/12 text-emerald-200"
                : roomStatus === "connecting"
                  ? "border-amber-300/25 bg-amber-300/12 text-amber-100"
                  : "border-rose-400/25 bg-rose-400/12 text-rose-200"
            }`}
          >
            {roomStatus}
          </span>
        </div>
      )}
      <div className="flex items-center gap-2">
        {isAdmin && (
          <button
            type="button"
            className={`inline-flex items-center gap-2 rounded-none border px-3 py-2 text-sm transition ${
              isAdminRoute
                ? "border-amber-300/30 bg-amber-300/14 text-amber-50"
                : "border-white/12 bg-white/5 text-slate-200 hover:border-amber-200/18 hover:bg-white/8"
            }`}
            onClick={onOpenAdmin}
          >
            <Shield size={15} />
            <span>Admin</span>
          </button>
        )}
        <button
          type="button"
          className="rounded-none border border-white/12 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:border-amber-200/18 hover:bg-white/8"
          onClick={onOpenCampaigns}
        >
          Campaigns
        </button>
        <button
          type="button"
          className="rounded-none border border-white/12 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:border-rose-200/18 hover:bg-white/8"
          onClick={onLogout}
        >
          Logout
        </button>
      </div>
    </header>
  );
}
