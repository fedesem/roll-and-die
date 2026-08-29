import type { MemberRole } from "@shared/types";
import { Shield, Users } from "lucide-react";

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
  onOpenCharacters?: () => void;
  isCharactersRoute?: boolean;
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
  onOpenCharacters,
  isCharactersRoute = false,
  onLogout
}: AppTopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 border-b border-amber-200/10 bg-slate-950/85 px-5 py-3 text-slate-100 backdrop-blur-xl">
      <div className="min-w-0">
        <p className="text-[0.7rem] font-medium uppercase tracking-[0.28em] text-amber-200/55">Logged in as {userName}</p>
        <h1 className="font-serif text-xl tracking-wide text-amber-100">Roll or Die</h1>
      </div>
      {showRoomStatus && campaignName && role && roomStatus && (
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-2">
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-0.5 text-xs font-semibold text-amber-200">
            {campaignName}
          </span>
          <span className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-0.5 text-xs text-slate-300">
            {activeMapName ?? "No map"}
          </span>
          <span className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-0.5 text-xs font-medium text-slate-300">
            {role.toUpperCase()}
          </span>
          <span
            className={`rounded-full border px-3 py-0.5 text-xs font-medium ${
              roomStatus === "online"
                ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
                : roomStatus === "connecting"
                  ? "border-amber-300/30 bg-amber-500/15 text-amber-200"
                  : "border-rose-400/30 bg-rose-500/15 text-rose-300"
            }`}
          >
            {roomStatus}
          </span>
        </div>
      )}
      <div className="flex items-center gap-2">
        {onOpenCharacters && (
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
              isCharactersRoute
                ? "border-amber-400/40 bg-amber-500/20 text-amber-50 shadow-sm"
                : "border-white/10 bg-slate-900/80 text-slate-200 hover:border-amber-500/40 hover:bg-slate-800"
            }`}
            onClick={onOpenCharacters}
          >
            <Users size={14} />
            <span>Characters</span>
          </button>
        )}
        {isAdmin && (
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
              isAdminRoute
                ? "border-amber-400/40 bg-amber-500/20 text-amber-50 shadow-sm"
                : "border-white/10 bg-slate-900/80 text-slate-200 hover:border-amber-500/40 hover:bg-slate-800"
            }`}
            onClick={onOpenAdmin}
          >
            <Shield size={14} />
            <span>Admin</span>
          </button>
        )}
        <button
          type="button"
          className="rounded-md border border-white/10 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-amber-500/40 hover:bg-slate-800"
          onClick={onOpenCampaigns}
        >
          Campaigns
        </button>
        <button
          type="button"
          className="rounded-md border border-white/10 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-rose-400/40 hover:bg-rose-950/40 hover:text-rose-200"
          onClick={onLogout}
        >
          Logout
        </button>
      </div>
    </header>
  );
}
