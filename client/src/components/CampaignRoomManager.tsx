import { useState } from "react";

import { Copy, Trash2 } from "lucide-react";

import type { CampaignSnapshot, MemberRole } from "@shared/types";

interface CampaignRoomManagerProps {
  campaign: CampaignSnapshot["campaign"];
  role: MemberRole;
  inviteDraft: {
    role: MemberRole;
  };
  onInviteDraftChange: (draft: { role: MemberRole }) => void;
  onCreateInvite: () => void;
  onRemoveInvite: (inviteId: string) => void;
}

export function CampaignRoomManager({
  campaign,
  role,
  inviteDraft,
  onInviteDraftChange,
  onCreateInvite,
  onRemoveInvite
}: CampaignRoomManagerProps) {
  const inviteBaseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  async function copyToClipboard(value: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    if (typeof document === "undefined") {
      throw new Error("Clipboard unavailable");
    }

    const element = document.createElement("textarea");
    element.value = value;
    element.setAttribute("readonly", "");
    element.style.position = "absolute";
    element.style.left = "-9999px";
    document.body.appendChild(element);
    element.select();
    document.execCommand("copy");
    document.body.removeChild(element);
  }

  async function handleCopyInvite(inviteId: string, inviteCode: string) {
    const inviteUrl = `${inviteBaseUrl}/join/${encodeURIComponent(inviteCode)}`;

    try {
      await copyToClipboard(inviteUrl);
      setCopiedInviteId(inviteId);
      window.setTimeout(() => {
        setCopiedInviteId((current) => (current === inviteId ? null : current));
      }, 1800);
    } catch {
      setCopiedInviteId(null);
    }
  }

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

          <div className="stack-form compact text-sm">
            <div className="inline-form compact items-end">
              <select
                className="!w-auto !min-w-[11rem] !px-3 !py-2 !text-xs"
                value={inviteDraft.role}
                onChange={(event) => onInviteDraftChange({ role: event.target.value as MemberRole })}
              >
                <option value="player">Player</option>
                <option value="dm">Dungeon Master</option>
              </select>
              <button type="button" className="!px-3 !py-2 !text-xs" onClick={onCreateInvite}>
                Create invite
              </button>
            </div>
          </div>

          <div className="invite-list">
            {campaign.invites.map((invite) => (
              <div key={invite.id} className="invite-card grid gap-3 p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="grid gap-1">
                    <p className="panel-label">Invite Code</p>
                    <strong className="font-mono text-base tracking-[0.18em] text-amber-100">{invite.code}</strong>
                  </div>
                  <span className="badge text-[0.65rem]">{invite.role === "dm" ? "Dungeon Master" : "Player"}</span>
                </div>
                <div className="grid gap-1">
                  <p className="panel-label">Link</p>
                  <p className="break-all font-mono text-[0.72rem] leading-5 text-slate-300">
                    {inviteBaseUrl}/join/{encodeURIComponent(invite.code)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="!inline-flex !items-center !gap-1.5 !px-3 !py-2 !text-xs"
                    onClick={() => void handleCopyInvite(invite.id, invite.code)}
                  >
                    <Copy size={13} />
                    {copiedInviteId === invite.id ? "Copied link" : "Copy link"}
                  </button>
                  <button
                    type="button"
                    className="danger-button !inline-flex !items-center !gap-1.5 !px-3 !py-2 !text-xs"
                    onClick={() => onRemoveInvite(invite.id)}
                  >
                    <Trash2 size={13} />
                    Remove
                  </button>
                </div>
              </div>
            ))}
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
