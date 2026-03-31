import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { ModalFrame } from "./ModalFrame";

export type WorkspaceModalSize = "default" | "compact" | "wide" | "full";

export interface WorkspaceModalControls {
  currentView: WorkspaceModalView;
  history: WorkspaceModalView[];
  pushView: (view: WorkspaceModalView) => void;
  replaceView: (view: WorkspaceModalView) => void;
  closeCurrentView: () => void;
  closeModal: () => void;
}

export interface WorkspaceModalView {
  id: string;
  title: string;
  size?: WorkspaceModalSize;
  data?: unknown;
}

type WorkspaceModalProps =
  | {
      title: string;
      onClose: () => void;
      size?: WorkspaceModalSize;
      backdropClassName?: string;
      children: ReactNode;
      initialView?: never;
    }
  | {
      onClose: () => void;
      initialView: WorkspaceModalView;
      backdropClassName?: string;
      children: (controls: WorkspaceModalControls) => ReactNode;
      title?: never;
      size?: never;
    };

function getSizeClass(size: WorkspaceModalSize) {
  const sizeClass =
    size === "compact" ? "max-w-3xl" : size === "wide" ? "max-w-6xl" : size === "full" ? "max-w-[min(96vw,120rem)]" : "max-w-5xl";

  return sizeClass;
}

export function WorkspaceModal(props: WorkspaceModalProps) {
  const stackMode = "initialView" in props;
  const initialPropView = stackMode ? props.initialView : null;
  const plainTitle = stackMode ? "" : props.title;
  const plainSize = stackMode ? "default" : (props.size ?? "default");
  const initialView = useMemo<WorkspaceModalView>(
    () =>
      initialPropView ?? {
        id: "__default__",
        title: plainTitle,
        size: plainSize
      },
    [initialPropView, plainSize, plainTitle]
  );
  const initialViewKey = useMemo(
    () =>
      JSON.stringify({
        id: initialView.id,
        title: initialView.title,
        size: initialView.size ?? "default",
        data: initialView.data ?? null
      }),
    [initialView.data, initialView.id, initialView.size, initialView.title]
  );
  const stableInitialViewRef = useRef(initialView);
  const stableInitialViewKeyRef = useRef(initialViewKey);

  if (stableInitialViewKeyRef.current !== initialViewKey) {
    stableInitialViewKeyRef.current = initialViewKey;
    stableInitialViewRef.current = initialView;
  }

  const stableInitialView = stableInitialViewRef.current;
  const [history, setHistory] = useState<WorkspaceModalView[]>([stableInitialView]);

  useEffect(() => {
    setHistory([stableInitialViewRef.current]);
  }, [initialViewKey]);

  const currentView = history[history.length - 1] ?? stableInitialView;
  const { onClose } = props;
  const closeCurrentView = useCallback(() => {
    if (history.length <= 1) {
      onClose();
      return;
    }

    setHistory((current) => current.slice(0, -1));
  }, [history.length, onClose]);
  const controls: WorkspaceModalControls = {
    currentView,
    history,
    pushView: (view) => {
      setHistory((current) => [...current, view]);
    },
    replaceView: (view) => {
      setHistory((current) => [...current.slice(0, -1), view]);
    },
    closeCurrentView,
    closeModal: onClose
  };
  const sizeClass = getSizeClass(currentView.size ?? "default");
  const backdropClassName = props.backdropClassName ?? "bg-slate-950/70 backdrop-blur-md";
  let content: ReactNode;

  if (stackMode) {
    const renderChildren = props.children as (controls: WorkspaceModalControls) => ReactNode;
    content = renderChildren(controls);
  } else {
    content = props.children;
  }

  return (
    <ModalFrame onClose={closeCurrentView} backdropClassName={backdropClassName} panelClassName={sizeClass}>
      <>
        <div className="flex items-center justify-between gap-4 border-b border-white/8 px-6 py-4">
          <h2 className="font-serif text-2xl tracking-wide text-amber-50">{currentView.title}</h2>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-none border border-white/10 bg-white/[0.04] p-0 text-lg font-semibold leading-none text-slate-200 transition hover:border-amber-200/18 hover:text-amber-50"
            onClick={closeCurrentView}
            aria-label="Close popup"
          >
            <span aria-hidden="true">X</span>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">{content}</div>
      </>
    </ModalFrame>
  );
}
