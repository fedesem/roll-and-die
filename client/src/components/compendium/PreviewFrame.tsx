import type { CampaignSourceBook, UserProfile } from "@shared/types";
import type { ReactNode } from "react";
import type { PreviewFrameProps } from "./types";

export function PreviewFrame({ eyebrow, title, source, sourceTitle, subtitle, children }: PreviewFrameProps) {
  return (
    <section className="admin-preview-card">
      <header className="admin-preview-header">
        <div>
          <p className="panel-label">{eyebrow}</p>
          <h3 className="admin-preview-title">{title}</h3>
          {subtitle ? <p className="admin-preview-subtitle">{subtitle}</p> : null}
        </div>
        {source ? (
          <span className="admin-preview-source" title={sourceTitle ?? source}>
            {source}
          </span>
        ) : null}
      </header>
      <div className="admin-preview-divider" />
      {children}
    </section>
  );
}

export function Section({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="admin-preview-section">
      <div className="admin-preview-section-head">
        <h4>{title}</h4>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function PreviewPlaceholder({ title, message }: { title: string; message: string }) {
  return (
    <section className="admin-preview-card admin-preview-card-empty">
      <div className="admin-preview-header">
        <div>
          <p className="panel-label">{title}</p>
          <h3>Preview</h3>
        </div>
      </div>
      <p className="panel-caption">{message}</p>
    </section>
  );
}

export function PreviewError({ title, message }: { title: string; message: string }) {
  return (
    <section className="admin-preview-card admin-preview-card-empty">
      <div className="admin-preview-header">
        <div>
          <p className="panel-label">{title}</p>
          <h3>Preview unavailable</h3>
        </div>
      </div>
      <p className="admin-preview-error">{message}</p>
    </section>
  );
}

export function UserPreviewCard({ user }: { user: UserProfile }) {
  return (
    <PreviewFrame eyebrow="User" title={user.name} source={user.isAdmin ? "Administrator" : "Member"} subtitle={user.email}>
      <div className="admin-preview-stack">
        <div className="admin-preview-keyvalue">
          <span>Access</span>
          <strong>{user.isAdmin ? "System administrator" : "Standard user"}</strong>
        </div>
        <div className="admin-preview-keyvalue">
          <span>User id</span>
          <strong>{user.id}</strong>
        </div>
      </div>
    </PreviewFrame>
  );
}

export function BookPreviewCard({ entry }: { entry: CampaignSourceBook }) {
  return (
    <PreviewFrame eyebrow="Book" title={entry.name} source={entry.source} sourceTitle={entry.name} subtitle={entry.group}>
      <div className="admin-preview-stack">
        <div className="admin-preview-keyvalue">
          <span>Published</span>
          <strong>{entry.published || "Unknown"}</strong>
        </div>
        <div className="admin-preview-keyvalue">
          <span>Author</span>
          <strong>{entry.author || "Unknown"}</strong>
        </div>
      </div>
    </PreviewFrame>
  );
}
