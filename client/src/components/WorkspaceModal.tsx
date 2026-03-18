import type { ReactNode } from "react";

interface WorkspaceModalProps {
  title: string;
  onClose: () => void;
  size?: "default" | "compact" | "wide" | "full";
  children: ReactNode;
}

export function WorkspaceModal({ title, onClose, size = "default", children }: WorkspaceModalProps) {
  const sizeClass =
    size === "compact"
      ? "max-w-3xl"
      : size === "wide"
        ? "max-w-6xl"
        : size === "full"
          ? "max-w-[min(96vw,120rem)]"
          : "max-w-5xl";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md" onClick={onClose}>
      <section
        className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-none border border-amber-200/12 bg-[linear-gradient(180deg,rgba(18,20,28,0.98),rgba(10,12,16,0.98))] shadow-[0_28px_90px_rgba(0,0,0,0.4)] ${sizeClass}`}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/8 px-6 py-4">
          <h2 className="font-serif text-2xl tracking-wide text-amber-50">{title}</h2>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-none border border-white/10 bg-white/[0.04] p-0 text-lg font-semibold leading-none text-slate-200 transition hover:border-amber-200/18 hover:text-amber-50"
            onClick={onClose}
            aria-label="Close popup"
          >
            <span aria-hidden="true">X</span>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-6 py-5">{children}</div>
      </section>
    </div>
  );
}
