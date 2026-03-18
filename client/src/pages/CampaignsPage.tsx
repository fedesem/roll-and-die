import type { CampaignSummary } from "@shared/types";

interface CampaignsPageProps {
  campaigns: CampaignSummary[];
  createCampaignName: string;
  joinCode: string;
  onCreateCampaignNameChange: (value: string) => void;
  onJoinCodeChange: (value: string) => void;
  onCreateCampaign: () => void;
  onAcceptInvite: () => void;
  onOpenCampaign: (campaignId: string) => void;
}

export function CampaignsPage({
  campaigns,
  createCampaignName,
  joinCode,
  onCreateCampaignNameChange,
  onJoinCodeChange,
  onCreateCampaign,
  onAcceptInvite,
  onOpenCampaign
}: CampaignsPageProps) {
  return (
    <main className="grid gap-5 px-4 py-6 lg:grid-cols-2 lg:px-8">
      <section className="rounded-none border border-amber-200/10 bg-slate-950/72 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-amber-200/55">Create</p>
            <h2 className="mt-2 font-serif text-2xl text-amber-50">New campaign room</h2>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            className="h-12 flex-1 rounded-none border border-white/10 bg-white/[0.04] px-4 text-slate-100 outline-none transition focus:border-amber-200/30 focus:bg-white/[0.06]"
            placeholder="Campaign name"
            value={createCampaignName}
            onChange={(event) => onCreateCampaignNameChange(event.target.value)}
          />
          <button className="inline-flex h-12 items-center justify-center rounded-none border border-amber-200/20 bg-amber-300/18 px-5 text-sm font-semibold text-amber-50 transition hover:bg-amber-300/24" type="button" onClick={onCreateCampaign}>
            Create
          </button>
        </div>
      </section>

      <section className="rounded-none border border-amber-200/10 bg-slate-950/72 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-amber-200/55">Join</p>
            <h2 className="mt-2 font-serif text-2xl text-amber-50">Accept invite code</h2>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            className="h-12 flex-1 rounded-none border border-white/10 bg-white/[0.04] px-4 text-slate-100 uppercase outline-none transition focus:border-amber-200/30 focus:bg-white/[0.06]"
            value={joinCode}
            onChange={(event) => onJoinCodeChange(event.target.value.toUpperCase())}
            placeholder="ABC123"
          />
          <button className="inline-flex h-12 items-center justify-center rounded-none border border-amber-200/20 bg-amber-300/18 px-5 text-sm font-semibold text-amber-50 transition hover:bg-amber-300/24" type="button" onClick={onAcceptInvite}>
            Join
          </button>
        </div>
      </section>

      <section className="rounded-none border border-amber-200/10 bg-slate-950/72 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl lg:col-span-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-amber-200/55">Access</p>
            <h2 className="mt-2 font-serif text-2xl text-amber-50">Your campaigns</h2>
          </div>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          Only campaigns you created or joined through an invite are listed here.
        </p>
        <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((entry) => (
            <button
              key={entry.id}
              className="rounded-none border border-white/10 bg-white/[0.03] p-5 text-left transition hover:border-amber-200/20 hover:bg-white/[0.05]"
              type="button"
              onClick={() => onOpenCampaign(entry.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <strong className="font-serif text-lg text-amber-50">{entry.name}</strong>
                <span className="rounded-none border border-amber-200/18 bg-amber-300/14 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-amber-100">{entry.role}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {entry.memberCount} members • {entry.actorCount} actors • {entry.mapCount} maps
              </p>
              <small className="mt-3 block text-xs uppercase tracking-[0.18em] text-slate-500">{new Date(entry.createdAt).toLocaleString()}</small>
            </button>
          ))}
          {campaigns.length === 0 && (
            <p className="rounded-none border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-slate-400">No accessible campaigns yet. Create one or join via invite code.</p>
          )}
        </div>
      </section>
    </main>
  );
}
