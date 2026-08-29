import { Popover as BasePopover } from "@base-ui/react";
import { X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

export const Popover = BasePopover.Root;
export const PopoverTrigger = BasePopover.Trigger;
export const PopoverClose = BasePopover.Close;

export interface PopoverContentProps extends ComponentProps<typeof BasePopover.Popup> {
  children?: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  showCloseButton?: boolean;
  arrow?: boolean;
}

export function PopoverContent({
  children,
  className = "",
  side = "bottom",
  sideOffset = 8,
  showCloseButton = false,
  arrow = true,
  ...props
}: PopoverContentProps) {
  return (
    <BasePopover.Portal>
      <BasePopover.Positioner side={side} sideOffset={sideOffset}>
        <BasePopover.Popup
          className={`z-50 w-72 rounded-lg border border-slate-700 bg-slate-900 p-4 text-slate-100 shadow-xl shadow-black/70 focus:outline-none ${className}`}
          {...props}
        >
          {showCloseButton && (
            <BasePopover.Close
              className="absolute right-2.5 top-2.5 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
              aria-label="Close popover"
            >
              <X className="h-3.5 w-3.5" />
            </BasePopover.Close>
          )}
          {children}
          {arrow && <BasePopover.Arrow className="fill-slate-900 stroke-slate-700" />}
        </BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  );
}
