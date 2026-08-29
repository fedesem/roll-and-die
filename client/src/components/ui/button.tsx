import { Button as BaseButton } from "@base-ui/react";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "gold";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-md shadow-amber-950/40 border border-amber-500/40 active:translate-y-px",
  secondary: "bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium border border-slate-700 active:translate-y-px",
  outline: "bg-transparent hover:bg-slate-800/60 text-slate-200 border border-slate-700 active:translate-y-px",
  ghost: "bg-transparent hover:bg-slate-800 text-slate-300 hover:text-slate-100 border border-transparent active:translate-y-px",
  danger:
    "bg-rose-900/80 hover:bg-rose-800 text-rose-100 font-medium border border-rose-700/60 shadow-md shadow-rose-950/40 active:translate-y-px",
  gold: "bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold shadow-lg shadow-amber-950/50 border border-amber-300/60 active:translate-y-px"
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1 text-xs rounded gap-1.5",
  md: "px-3.5 py-1.5 text-sm rounded-md gap-2",
  lg: "px-5 py-2.5 text-base rounded-lg gap-2.5",
  icon: "h-9 w-9 p-0 rounded-md justify-center items-center"
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Button({
  children,
  className = "",
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  leftIcon,
  rightIcon,
  ...props
}: ButtonProps) {
  const combinedDisabled = disabled || isLoading;

  return (
    <BaseButton
      disabled={combinedDisabled}
      className={`inline-flex items-center justify-center transition-all duration-150 select-none cursor-pointer disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-current shrink-0" /> : leftIcon}
      {children}
      {!isLoading && rightIcon}
    </BaseButton>
  );
}
