import { Switch as BaseSwitch } from "@base-ui/react";
import type { ComponentProps } from "react";

export interface SwitchProps extends ComponentProps<typeof BaseSwitch.Root> {
  label?: string;
  description?: string;
}

export function Switch({ className = "", label, description, disabled, ...props }: SwitchProps) {
  const switchElement = (
    <BaseSwitch.Root
      disabled={disabled}
      className={`group relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:bg-amber-600 bg-slate-700 ${className}`}
      {...props}
    >
      <BaseSwitch.Thumb className="pointer-events-none inline-block h-5 w-5 rounded-full bg-slate-100 shadow-lg ring-0 transition-transform duration-200 ease-in-out data-[checked]:translate-x-5 translate-x-0" />
    </BaseSwitch.Root>
  );

  if (!label && !description) {
    return switchElement;
  }

  return (
    <label className="flex items-start space-x-3 cursor-pointer select-none">
      {switchElement}
      <div className="flex flex-col">
        {label && <span className="text-sm font-medium text-slate-200">{label}</span>}
        {description && <span className="text-xs text-slate-400">{description}</span>}
      </div>
    </label>
  );
}
