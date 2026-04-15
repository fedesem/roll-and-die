import type { ReactNode } from "react";

interface AdminScrollRegionProps {
  children: ReactNode;
  variant: "list" | "preview";
  className?: string;
}

const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");

export function AdminScrollRegion({ children, variant, className }: AdminScrollRegionProps) {
  return (
    <div className={cx("admin-scroll-region", variant === "list" ? "admin-list-scroll" : "admin-preview-scroll", className)}>
      {children}
    </div>
  );
}
