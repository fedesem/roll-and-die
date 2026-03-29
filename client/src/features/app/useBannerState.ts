import { useCallback, useEffect, useState } from "react";

import type { BannerState } from "../campaign/types";

export function useBannerState() {
  const [banner, setBanner] = useState<BannerState | null>(null);

  useEffect(() => {
    if (!banner) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setBanner((current) => (current === banner ? null : current));
    }, 10_000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [banner]);

  const setBannerStatus = useCallback((tone: BannerState["tone"], text: string) => {
    setBanner({ tone, text });
  }, []);

  return {
    banner,
    setBanner,
    setBannerStatus
  };
}
