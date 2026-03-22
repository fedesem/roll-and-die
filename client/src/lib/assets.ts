const absoluteUrlPattern = /^(?:[a-z]+:)?\/\//i;

export function resolveAssetUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:") || absoluteUrlPattern.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("/uploads/")) {
    const configuredAssetBase = import.meta.env.VITE_ASSET_URL;

    if (typeof configuredAssetBase === "string" && configuredAssetBase.trim()) {
      return new URL(trimmed, configuredAssetBase.trim()).toString();
    }

    const configuredApiBase = import.meta.env.VITE_API_URL;

    if (typeof configuredApiBase === "string" && absoluteUrlPattern.test(configuredApiBase.trim())) {
      return new URL(trimmed, configuredApiBase.trim()).toString();
    }
  }

  return trimmed;
}
