import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface CampaignActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  children?: ReactNode;
  tone?: "default" | "accent" | "danger";
  active?: boolean;
  stretch?: boolean;
  align?: "center" | "start";
}

export function CampaignActionButton({
  icon: Icon,
  children,
  tone = "default",
  active = false,
  stretch = false,
  align = "center",
  className,
  type = "button",
  ...buttonProps
}: CampaignActionButtonProps) {
  const classes = [
    "campaign-action-button",
    `is-${tone}`,
    children ? "has-label" : "is-icon-only",
    active ? "is-active" : "",
    stretch ? "is-stretch" : "",
    align === "start" ? "is-align-start" : "",
    className ?? ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} {...buttonProps}>
      <Icon className="campaign-action-button__icon" aria-hidden="true" />
      {children ? <span className="campaign-action-button__label">{children}</span> : null}
    </button>
  );
}
