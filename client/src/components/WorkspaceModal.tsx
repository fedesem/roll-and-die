import type { ReactNode } from "react";
import { X } from "lucide-react";

interface WorkspaceModalProps {
  title: string;
  onClose: () => void;
  size?: "default" | "compact" | "wide" | "full";
  children: ReactNode;
}

export function WorkspaceModal({ title, onClose, size = "default", children }: WorkspaceModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className={`modal-card ${size !== "default" ? size : ""}`}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-action-button modal-close-button" onClick={onClose} aria-label="Close popup">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}
