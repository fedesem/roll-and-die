interface CampaignJoinPageProps {
  joinCode: string;
  hasInviteLink: boolean;
  onJoinCodeChange: (value: string) => void;
  onAcceptInvite: () => void;
  onBack: () => void;
}

export function CampaignJoinPage({
  joinCode,
  hasInviteLink,
  onJoinCodeChange,
  onAcceptInvite,
  onBack
}: CampaignJoinPageProps) {
  return (
    <main className="grid gap-5 px-4 py-6 lg:px-8">
      <section className="rounded-none border border-amber-200/10 bg-slate-950/72 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-amber-200/55">Join</p>
            <h2 className="mt-2 font-serif text-2xl text-amber-50">{hasInviteLink ? "Accept campaign invite" : "Accept invite code"}</h2>
          </div>
          <button className="inline-flex h-11 items-center justify-center rounded-none border border-white/12 bg-white/5 px-4 text-sm font-semibold text-slate-100 transition hover:border-amber-200/18 hover:bg-white/8" type="button" onClick={onBack}>
            Back to campaigns
          </button>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          {hasInviteLink ? "This invite link already contains the campaign code. Review it below and join the room." : "Paste an invite code or open a shared invite link to join a campaign."}
        </p>
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
    </main>
  );
}
