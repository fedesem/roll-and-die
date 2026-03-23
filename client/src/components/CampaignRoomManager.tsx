import type { CampaignSnapshot, MemberRole } from "@shared/types";

interface CampaignRoomManagerProps {
  campaign: CampaignSnapshot["campaign"];
  role: MemberRole;
  inviteDraft: {
    label: string;
    role: MemberRole;
  };
  onInviteDraftChange: (draft: { label: string; role: MemberRole }) => void;
  onCreateInvite: () => void;
}

export function CampaignRoomManager({
  campaign,
  role,
  inviteDraft,
  onInviteDraftChange,
  onCreateInvite
}: CampaignRoomManagerProps) {
  const inviteBaseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <section className="rounded-none border border-amber-200/10 bg-slate-950/72 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-amber-200/55">Room</p>
          <h2 className="mt-2 font-serif text-2xl text-amber-50">Members and access</h2>
        </div>
        <span className="rounded-none border border-white/10 bg-white/[0.04] px-3 py-2 text-xs uppercase tracking-[0.18em] text-slate-300">
          {role}
        </span>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <section className="rounded-none border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-slate-500">Members</p>
              <h3 className="mt-2 font-serif text-xl text-amber-50">{campaign.name}</h3>
            </div>
            <span className="rounded-none border border-white/10 bg-slate-950/70 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
              {campaign.members.length}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {campaign.members.map((member) => (
              <div
                key={member.userId}
                className="flex items-center justify-between gap-3 border border-white/10 bg-slate-950/65 px-4 py-3 text-sm text-slate-200"
              >
                <span>{member.name}</span>
                <span className="rounded-none border border-white/10 bg-white/[0.04] px-2 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-slate-400">
                  {member.role}
                </span>
              </div>
            ))}
          </div>
        </section>

        {role === "dm" ? (
          <section className="rounded-none border border-white/10 bg-white/[0.04] p-5">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-slate-500">Invites</p>
              <h3 className="mt-2 font-serif text-xl text-amber-50">Role-based access</h3>
            </div>

            <div className="mt-4 grid gap-3">
              <input
                className="h-11 rounded-none border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-amber-200/30"
                value={inviteDraft.label}
                placeholder="Invite label"
                onChange={(event) => onInviteDraftChange({ ...inviteDraft, label: event.target.value })}
              />
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <select
                  className="h-11 rounded-none border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none transition focus:border-amber-200/30"
                  value={inviteDraft.role}
                  onChange={(event) => onInviteDraftChange({ ...inviteDraft, role: event.target.value as MemberRole })}
                >
                  <option value="player">Player</option>
                  <option value="dm">Dungeon Master</option>
                </select>
                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center rounded-none border border-amber-200/20 bg-amber-300/18 px-4 text-sm font-semibold text-amber-50 transition hover:bg-amber-300/24"
                  onClick={onCreateInvite}
                >
                  Create invite
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {campaign.invites.map((invite) => {
                const inviteUrl = `${inviteBaseUrl}/join/${encodeURIComponent(invite.code)}`;

                return (
                  <div key={invite.id} className="border border-white/10 bg-slate-950/65 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <strong className="font-mono text-sm text-amber-100">{invite.code}</strong>
                      <span className="rounded-none border border-white/10 bg-white/[0.04] px-2 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-slate-400">
                        {invite.role}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-200">{invite.label}</p>
                    <a
                      className="mt-3 block break-all text-sm text-amber-200 transition hover:text-amber-100"
                      href={inviteUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {inviteUrl}
                    </a>
                  </div>
                );
              })}
              {campaign.invites.length === 0 && <p className="text-sm text-slate-400">No active invites.</p>}
            </div>
          </section>
        ) : (
          <section className="rounded-none border border-white/10 bg-white/[0.04] p-5">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-slate-500">Room Notes</p>
              <h3 className="mt-2 font-serif text-xl text-amber-50">Shared table</h3>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-400">
              Players can manage their roster here before opening the live board, then use chat and sheet actions during play.
            </p>
          </section>
        )}
      </div>
    </section>
  );
}
