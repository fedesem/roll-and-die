import { type ReactNode, useEffect } from "react";
import { Z_INDEX } from "../lib/layers";

interface ModalFrameProps {
  children: ReactNode;
  onClose?: () => void;
  backdropClassName?: string;
  panelClassName?: string;
  closeOnBackdrop?: boolean;
  allowBackgroundInteraction?: boolean;
}

let activeModalCount = 0;
let previousBodyOverflow = "";
let previousHtmlOverflow = "";

function acquirePageScrollLock() {
  if (typeof document === "undefined") {
    return () => undefined;
  }

  if (activeModalCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
  }

  activeModalCount += 1;

  return () => {
    activeModalCount = Math.max(0, activeModalCount - 1);

    if (activeModalCount === 0) {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    }
  };
}

export function ModalFrame({
  children,
  onClose,
  backdropClassName = "bg-slate-950/70 backdrop-blur-md",
  panelClassName = "",
  closeOnBackdrop = true,
  allowBackgroundInteraction = false
}: ModalFrameProps) {
  const layerIndex = Math.min(Z_INDEX.FLOATING_LAYER - 5, Z_INDEX.MODAL_BACKDROP + (activeModalCount - 1) * 10);

  useEffect(() => acquirePageScrollLock(), []);

  return (
    <div
      className={`fixed inset-0 overflow-hidden ${allowBackgroundInteraction ? "pointer-events-none" : ""} ${backdropClassName}`}
      style={{ zIndex: layerIndex }}
      onClick={closeOnBackdrop && onClose ? onClose : undefined}
    >
      <div className="flex h-full w-full items-center justify-center p-4 sm:p-6">
        <section
          className={`relative pointer-events-auto flex h-[90dvh] min-h-0 w-full flex-col overflow-hidden rounded-xl border border-amber-500/25 bg-slate-950/95 shadow-[0_28px_90px_rgba(0,0,0,0.75)] backdrop-blur-xl ${panelClassName}`}
          onScroll={(event) => {
            if (event.currentTarget.scrollTop !== 0) {
              event.currentTarget.scrollTop = 0;
            }
            if (event.currentTarget.scrollLeft !== 0) {
              event.currentTarget.scrollLeft = 0;
            }
          }}
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          {children}
        </section>
      </div>
    </div>
  );
}
