import { Tooltip as BaseTooltip } from "@base-ui/react";
import type { ComponentProps, ReactNode } from "react";

export const TooltipProvider = BaseTooltip.Provider;
export const TooltipRoot = BaseTooltip.Root;
export const TooltipTrigger = BaseTooltip.Trigger;
export const TooltipPortal = BaseTooltip.Portal;

export interface TooltipProps extends ComponentProps<typeof BaseTooltip.Root> {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  className?: string;
}

export function Tooltip({ content, children, side = "top", sideOffset = 6, className = "", ...props }: TooltipProps) {
  return (
    <BaseTooltip.Root {...props}>
      <BaseTooltip.Trigger render={children as any} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} sideOffset={sideOffset}>
          <BaseTooltip.Popup
            className={`z-50 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 shadow-lg shadow-black/60 select-none animate-in fade-in-0 zoom-in-95 ${className}`}
          >
            {content}
            <BaseTooltip.Arrow className="fill-slate-900 stroke-slate-700" />
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
