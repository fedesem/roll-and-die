import { useEffect, type ReactNode } from "react";

interface ModalFrameProps {
  children: ReactNode;
  onClose?: () => void;
  backdropClassName?: string;
  panelClassName?: string;
  closeOnBackdrop?: boolean;
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
  closeOnBackdrop = true
}: ModalFrameProps) {
  const layerIndex = 50 + activeModalCount * 10;

  useEffect(() => acquirePageScrollLock(), []);

  return (
    <div
      className={`fixed inset-0 overflow-hidden ${backdropClassName}`}
      style={{ zIndex: layerIndex }}
      onClick={closeOnBackdrop && onClose ? onClose : undefined}
    >
      <div className="flex h-full w-full items-center justify-center p-4">
        <section
          className={`flex h-[90dvh] min-h-0 w-full flex-col overflow-hidden rounded-none border border-amber-200/12 bg-[linear-gradient(180deg,rgba(18,20,28,0.98),rgba(10,12,16,0.98))] shadow-[0_28px_90px_rgba(0,0,0,0.4)] ${panelClassName}`}
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
