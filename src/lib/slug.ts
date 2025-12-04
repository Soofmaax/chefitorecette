export const generateSlug = (input: string): string =>
  input
    .toLowerCase()
    .trim()
    // Remplace tout ce qui n'est pas alphanumérique par des tirets
    .replace(/[^a-z0-9]+/g, "-")
    // Supprime les tirets en début / fin
    .replace(/^-+|-+$/g, "");