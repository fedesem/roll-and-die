import type { ReactNode } from "react";

interface IconButtonProps {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  className?: string;
  type?: "button" | "submit";
  size?: "xs" | "sm" | "md";
}

export function IconButton({
  icon,
  label,
  onClick,
  disabled = false,
  active = false,
  className = "",
  type = "button",
  size = "md"
}: IconButtonProps) {
  const buttonSizeClass = size === "xs" ? "h-6 w-6" : size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const iconSizeClass = size === "xs" ? "h-3 w-3" : size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex ${buttonSizeClass} items-center justify-center border p-0 transition ${
        active
          ? "border-amber-500 bg-amber-500 text-zinc-950"
          : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-amber-500/70 hover:text-amber-50"
      } disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      <span className={`flex ${iconSizeClass} items-center justify-center`}>{icon}</span>
    </button>
  );
}
