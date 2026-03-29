import type { RoomStatus } from "../services/roomConnection";

export function CampaignLoadingPage({ roomStatus }: { roomStatus: RoomStatus }) {
  return (
    <main className="px-4 py-6 lg:px-8">
      <section className="rounded-none border border-amber-200/10 bg-slate-950/72 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-amber-200/55">Room</p>
            <h2 className="mt-2 font-serif text-2xl text-amber-50">Connecting to campaign</h2>
          </div>
          <span className="rounded-none border border-white/10 bg-white/[0.05] px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-200">
            {roomStatus}
          </span>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-400">Loading the active map, room chat, and current visibility state.</p>
      </section>
    </main>
  );
}
