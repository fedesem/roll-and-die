import { Dialog as BaseDialog } from "@base-ui/react";
import { X } from "lucide-react";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";

export const Dialog = BaseDialog.Root;
export const DialogTrigger = BaseDialog.Trigger;
export const DialogPortal = BaseDialog.Portal;
export const DialogClose = BaseDialog.Close;

export function DialogBackdrop({ className = "", ...props }: ComponentProps<typeof BaseDialog.Backdrop>) {
  return (
    <BaseDialog.Backdrop
      className={`fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm transition-opacity duration-200 ${className}`}
      {...props}
    />
  );
}

export interface DialogContentProps extends ComponentProps<typeof BaseDialog.Popup> {
  children?: ReactNode;
  showCloseButton?: boolean;
}

export function DialogContent({ children, className = "", showCloseButton = true, ...props }: DialogContentProps) {
  return (
    <BaseDialog.Portal>
      <DialogBackdrop />
      <BaseDialog.Popup
        className={`fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-xl border border-slate-700/80 bg-slate-900/95 p-6 text-slate-100 shadow-2xl shadow-black/80 backdrop-blur-md transition-all duration-200 focus:outline-none ${className}`}
        {...props}
      >
        {children}
        {showCloseButton && (
          <BaseDialog.Close
            className="absolute right-4 top-4 rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </BaseDialog.Close>
        )}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  );
}

export function DialogHeader({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`flex flex-col space-y-1.5 text-left mb-4 ${className}`} {...props} />;
}

export function DialogTitle({ className = "", ...props }: ComponentProps<typeof BaseDialog.Title>) {
  return <BaseDialog.Title className={`text-lg font-semibold tracking-tight text-amber-400 ${className}`} {...props} />;
}

export function DialogDescription({ className = "", ...props }: ComponentProps<typeof BaseDialog.Description>) {
  return <BaseDialog.Description className={`text-sm text-slate-300 ${className}`} {...props} />;
}

export function DialogFooter({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6 ${className}`} {...props} />;
}
