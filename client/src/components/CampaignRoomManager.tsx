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
    <div className="admin-content-grid">
      <section className="admin-pane admin-list-pane">
        <div className="panel-head">
          <div>
            <p className="panel-label">Members</p>
            <h3>{campaign.name}</h3>
          </div>
          <div className="admin-row-actions">
            <span className="badge subtle">{campaign.members.length}</span>
            <span className="badge subtle">{role}</span>
          </div>
        </div>

        <div className="list-stack">
          {campaign.members.map((member) => (
            <div key={member.userId} className="admin-list-row">
              <div className="admin-list-main">
                <strong>{member.name}</strong>
              </div>
              <div className="admin-list-badges">
                <span className="badge subtle">{member.role}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {role === "dm" ? (
        <section className="admin-pane admin-preview-pane">
          <div className="panel-head">
            <div>
              <p className="panel-label">Access</p>
              <h3>Role-based access</h3>
            </div>
          </div>

          <div className="stack-form compact">
            <input
              value={inviteDraft.label}
              placeholder="Invite label"
              onChange={(event) => onInviteDraftChange({ ...inviteDraft, label: event.target.value })}
            />
            <div className="inline-form compact">
              <select
                value={inviteDraft.role}
                onChange={(event) => onInviteDraftChange({ ...inviteDraft, role: event.target.value as MemberRole })}
              >
                <option value="player">Player</option>
                <option value="dm">Dungeon Master</option>
              </select>
              <button type="button" onClick={onCreateInvite}>
                Create invite
              </button>
            </div>
          </div>

          <div className="invite-list">
            {campaign.invites.map((invite) => {
              const inviteUrl = `${inviteBaseUrl}/join/${encodeURIComponent(invite.code)}`;

              return (
                <div key={invite.id} className="invite-card">
                  <strong>{invite.code}</strong>
                  <span>{invite.label}</span>
                  <a href={inviteUrl} target="_blank" rel="noreferrer">
                    {inviteUrl}
                  </a>
                  <small>{invite.role}</small>
                </div>
              );
            })}
            {campaign.invites.length === 0 && <p className="empty-state">No active invites.</p>}
          </div>
        </section>
      ) : (
        <section className="admin-pane admin-preview-pane">
          <div className="panel-head">
            <div>
              <p className="panel-label">Room Notes</p>
              <h3>Shared table</h3>
            </div>
          </div>
          <p className="panel-caption">
            Players can manage their roster here before opening the live board, then use chat and sheet actions during play.
          </p>
        </section>
      )}
    </div>
  );
}
