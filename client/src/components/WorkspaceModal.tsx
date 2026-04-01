import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { IconButton } from "./IconButton";
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

interface WorkspaceModalHeaderContextValue {
  setHeaderActions: (actions: ReactNode | null) => void;
}

const WorkspaceModalHeaderContext = createContext<WorkspaceModalHeaderContextValue | null>(null);

type WorkspaceModalProps =
  | {
      title: string;
      onClose: () => void;
      size?: WorkspaceModalSize;
      backdropClassName?: string;
      allowBackgroundInteraction?: boolean;
      children: ReactNode;
      initialView?: never;
    }
  | {
      onClose: () => void;
      initialView: WorkspaceModalView;
      backdropClassName?: string;
      allowBackgroundInteraction?: boolean;
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
  const [headerActions, setHeaderActions] = useState<ReactNode | null>(null);
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
  const allowBackgroundInteraction = props.allowBackgroundInteraction ?? false;
  let content: ReactNode;

  if (stackMode) {
    const renderChildren = props.children as (controls: WorkspaceModalControls) => ReactNode;
    content = renderChildren(controls);
  } else {
    content = props.children;
  }

  return (
    <ModalFrame
      onClose={closeCurrentView}
      backdropClassName={backdropClassName}
      panelClassName={sizeClass}
      allowBackgroundInteraction={allowBackgroundInteraction}
    >
      <WorkspaceModalHeaderContext.Provider value={{ setHeaderActions }}>
        <>
          <div className="flex items-center justify-between gap-4 border-b border-white/8 px-6 py-4">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
              <h2 className="min-w-0 shrink-0 truncate font-serif text-2xl tracking-wide text-amber-50">{currentView.title}</h2>
              {headerActions ? <div className="flex min-w-0 flex-wrap items-center gap-2">{headerActions}</div> : null}
            </div>
            <div className="flex justify-end">
              <IconButton
                icon={<span aria-hidden="true">X</span>}
                label="Close popup"
                onClick={closeCurrentView}
                className="text-base font-semibold leading-none"
                size="xs"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">{content}</div>
        </>
      </WorkspaceModalHeaderContext.Provider>
    </ModalFrame>
  );
}

export function useWorkspaceModalHeader(actions: ReactNode | null) {
  const context = useContext(WorkspaceModalHeaderContext);

  useEffect(() => {
    context?.setHeaderActions(actions);

    return () => {
      context?.setHeaderActions(null);
    };
  }, [actions, context]);
}
