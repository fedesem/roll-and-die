import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

import { readJson, writeJson } from "../lib/storage";

export function usePersistentState<T>(key: string, initialValue: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    const stored = readJson<T>(key);

    if (stored !== null) {
      return stored;
    }

    return typeof initialValue === "function" ? (initialValue as () => T)() : initialValue;
  });

  useEffect(() => {
    writeJson(key, state);
  }, [key, state]);

  return [state, setState];
}
