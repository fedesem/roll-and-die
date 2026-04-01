import type { ReactNode } from "react";

interface IconButtonProps {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  className?: string;
  type?: "button" | "submit";
}

export function IconButton({
  icon,
  label,
  onClick,
  disabled = false,
  active = false,
  className = "",
  type = "button"
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 w-9 items-center justify-center border p-0 transition ${
        active
          ? "border-amber-500 bg-amber-500 text-zinc-950"
          : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-amber-500/70 hover:text-amber-50"
      } disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      <span className="flex h-4 w-4 items-center justify-center">{icon}</span>
    </button>
  );
}
