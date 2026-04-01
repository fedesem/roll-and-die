import { useEffect, useState, type ChangeEvent, type ComponentPropsWithoutRef, type FocusEvent } from "react";

interface NumericInputProps extends Omit<ComponentPropsWithoutRef<"input">, "type" | "value" | "onChange"> {
  value: number | null | undefined;
  onValueChange: (value: number | null) => void;
  emptyValue?: number | null;
}

function clampValue(value: number, min?: number, max?: number) {
  let nextValue = value;

  if (typeof min === "number") {
    nextValue = Math.max(min, nextValue);
  }

  if (typeof max === "number") {
    nextValue = Math.min(max, nextValue);
  }

  return nextValue;
}

function toNumericBound(value: string | number | undefined) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function toDraftString(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

export function NumericInput({
  value,
  onValueChange,
  emptyValue = 0,
  min,
  max,
  onBlur,
  onFocus,
  ...props
}: NumericInputProps) {
  const [draft, setDraft] = useState(() => toDraftString(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(toDraftString(value));
    }
  }, [focused, value]);

  function commitDraft(rawValue: string) {
    if (rawValue.trim() === "") {
      onValueChange(emptyValue);
      return emptyValue;
    }

    const parsed = Number(rawValue);

    if (!Number.isFinite(parsed)) {
      return value ?? emptyValue;
    }

    const normalized = clampValue(parsed, toNumericBound(min), toNumericBound(max));
    onValueChange(normalized);
    return normalized;
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const nextDraft = event.target.value;
    setDraft(nextDraft);
    commitDraft(nextDraft);
  }

  function handleFocus(event: FocusEvent<HTMLInputElement>) {
    setFocused(true);
    onFocus?.(event);
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    setFocused(false);
    const committed = commitDraft(draft);
    setDraft(toDraftString(committed));
    onBlur?.(event);
  }

  return <input {...props} type="number" min={min} max={max} value={draft} onChange={handleChange} onFocus={handleFocus} onBlur={handleBlur} />;
}
