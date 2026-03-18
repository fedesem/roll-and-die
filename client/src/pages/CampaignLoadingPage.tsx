import type { RoomStatus } from "../services/roomConnection";

export function CampaignLoadingPage({ roomStatus }: { roomStatus: RoomStatus }) {
  return (
    <main className="dashboard-grid">
      <section className="dark-card span-full">
        <div className="panel-head">
          <div>
            <p className="panel-label">Room</p>
            <h2>Connecting to campaign</h2>
          </div>
          <span className="badge subtle">{roomStatus}</span>
        </div>
        <p className="panel-caption">Loading the active map, room chat, and current visibility state.</p>
      </section>
    </main>
  );
}
