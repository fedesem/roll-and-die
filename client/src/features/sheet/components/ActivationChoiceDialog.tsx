import type { ProgressionChoiceGroupDef } from "@shared/data/progression";

import { GuidedChoiceGroupField } from "./GuidedChoiceGroupField";

export function ActivationChoiceDialog(props: {
  group: ProgressionChoiceGroupDef;
  selectedOptionIds: string[];
  onChange: (optionIds: string[]) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const group = {
    id: props.group.id,
    label: props.group.title,
    count: props.group.choose,
    options: props.group.options.map((option) => ({ id: option.id, label: option.name, description: "" }))
  };
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-xl border border-white/10 bg-slate-950 p-5 shadow-2xl">
        <h2 className="text-lg font-semibold text-zinc-100">Choose {props.group.title}</h2>
        <p className="mt-1 text-sm text-zinc-400">This choice applies to the activation you are starting now.</p>
        <div className="mt-4">
          <GuidedChoiceGroupField group={group} selectedIds={props.selectedOptionIds} onChange={props.onChange} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={props.onCancel} className="rounded-md border border-white/10 px-3 py-2 text-sm text-zinc-300">
            Cancel
          </button>
          <button
            type="button"
            disabled={props.selectedOptionIds.length !== props.group.choose}
            onClick={props.onConfirm}
            className="rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
          >
            Activate
          </button>
        </div>
      </div>
    </div>
  );
}
