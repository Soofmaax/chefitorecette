export const extractTextFromHTML = (html: string): string => {
  if (!html) return "";

  // Suppression naïve des balises HTML et normalisation des espaces
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
};