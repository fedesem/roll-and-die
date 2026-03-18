export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Invalid file payload."));
    });

    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error("Unable to read file."));
    });

    reader.readAsDataURL(file);
  });
}
