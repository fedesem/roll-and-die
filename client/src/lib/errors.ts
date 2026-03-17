export function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error.";
}
