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
    <main className="dashboard-grid">
      <section className="dark-card">
        <div className="panel-head">
          <div>
            <p className="panel-label">Create</p>
            <h2>New campaign room</h2>
          </div>
        </div>
        <div className="inline-form">
          <input placeholder="Campaign name" value={createCampaignName} onChange={(event) => onCreateCampaignNameChange(event.target.value)} />
          <button className="accent-button" type="button" onClick={onCreateCampaign}>
            Create
          </button>
        </div>
      </section>

      <section className="dark-card">
        <div className="panel-head">
          <div>
            <p className="panel-label">Join</p>
            <h2>Accept invite code</h2>
          </div>
        </div>
        <div className="inline-form">
          <input value={joinCode} onChange={(event) => onJoinCodeChange(event.target.value.toUpperCase())} placeholder="ABC123" />
          <button className="accent-button" type="button" onClick={onAcceptInvite}>
            Join
          </button>
        </div>
      </section>

      <section className="dark-card span-full">
        <div className="panel-head">
          <div>
            <p className="panel-label">Access</p>
            <h2>Your campaigns</h2>
          </div>
        </div>
        <p className="panel-caption">
          Only campaigns you created or joined through an invite are listed here.
        </p>
        <div className="campaign-grid">
          {campaigns.map((entry) => (
            <button key={entry.id} className="campaign-card" type="button" onClick={() => onOpenCampaign(entry.id)}>
              <div className="campaign-card-head">
                <strong>{entry.name}</strong>
                <span className="badge">{entry.role}</span>
              </div>
              <p>
                {entry.memberCount} members • {entry.actorCount} actors • {entry.mapCount} maps
              </p>
              <small>{new Date(entry.createdAt).toLocaleString()}</small>
            </button>
          ))}
          {campaigns.length === 0 && (
            <p className="empty-state">No accessible campaigns yet. Create one or join via invite code.</p>
          )}
        </div>
      </section>
    </main>
  );
}
