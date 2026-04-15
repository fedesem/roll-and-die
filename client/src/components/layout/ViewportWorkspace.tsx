import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from "react";

type WorkspaceHeightMode = "viewport" | "fill";
type WorkspaceScrollBehavior = "pane" | "page";
type WorkspaceStackBreakpoint = "none" | "1100" | "1180" | "1280" | "1500";
type WorkspaceScrollMode = "y" | "x" | "both" | "none";

interface ViewportWorkspaceProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  children: ReactNode;
  columns?: string;
  workspaceMinHeight?: number | string;
  viewportOffset?: number | string;
  stackBreakpoint?: WorkspaceStackBreakpoint;
  heightMode?: WorkspaceHeightMode;
  scrollBehavior?: WorkspaceScrollBehavior;
}

interface WorkspacePaneProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  children: ReactNode;
}

interface WorkspacePaneBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  contentClassName?: string;
  fill?: boolean;
  scroll?: WorkspaceScrollMode;
}

const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");

export function ViewportWorkspace({
  as,
  children,
  className,
  columns = "minmax(320px, 0.82fr) minmax(0, 1.18fr)",
  workspaceMinHeight = "32rem",
  viewportOffset = "12rem",
  stackBreakpoint = "1100",
  heightMode = "viewport",
  scrollBehavior = "pane",
  style,
  ...rest
}: ViewportWorkspaceProps) {
  const Component = as ?? "div";
  const workspaceStyle = {
    ...style,
    "--workspace-columns": columns,
    "--workspace-min-height": toCssLength(workspaceMinHeight),
    "--workspace-viewport-offset": toCssLength(viewportOffset)
  } as CSSProperties;

  return (
    <Component
      className={cx(
        "viewport-workspace",
        `viewport-workspace--${heightMode}`,
        `viewport-workspace--stack-${stackBreakpoint}`,
        scrollBehavior === "pane" && "viewport-workspace--pane-scroll",
        className
      )}
      style={workspaceStyle}
      {...rest}
    >
      {children}
    </Component>
  );
}

export function WorkspacePane({ as, children, className, ...rest }: WorkspacePaneProps) {
  const Component = as ?? "section";

  return (
    <Component className={cx("workspace-pane", className)} {...rest}>
      {children}
    </Component>
  );
}

export function WorkspacePaneBody({
  children,
  className,
  contentClassName,
  fill = false,
  scroll = "y",
  ...rest
}: WorkspacePaneBodyProps) {
  return (
    <div className={cx("workspace-pane-body", `workspace-pane-body--scroll-${scroll}`, fill && "workspace-pane-body--fill", className)} {...rest}>
      <div className={cx("workspace-pane-body__content", contentClassName)}>{children}</div>
    </div>
  );
}

function toCssLength(value: number | string) {
  return typeof value === "number" ? `${value}px` : value;
}
