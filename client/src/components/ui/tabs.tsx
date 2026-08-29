import { Tabs as BaseTabs } from "@base-ui/react";
import type { ComponentProps } from "react";

export const Tabs = BaseTabs.Root;

export function TabsList({ className = "", ...props }: ComponentProps<typeof BaseTabs.List>) {
  return (
    <BaseTabs.List
      className={`inline-flex items-center justify-center rounded-lg bg-slate-800/80 p-1 text-slate-400 border border-slate-700/60 ${className}`}
      {...props}
    />
  );
}

export function Tab({ className = "", ...props }: ComponentProps<typeof BaseTabs.Tab>) {
  return (
    <BaseTabs.Tab
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 disabled:pointer-events-none disabled:opacity-50 data-[selected]:bg-amber-600 data-[selected]:text-white data-[selected]:shadow-sm text-slate-300 hover:text-slate-100 cursor-pointer ${className}`}
      {...props}
    />
  );
}

export function TabPanel({ className = "", ...props }: ComponentProps<typeof BaseTabs.Panel>) {
  return <BaseTabs.Panel className={`mt-3 focus-visible:outline-none ${className}`} {...props} />;
}
