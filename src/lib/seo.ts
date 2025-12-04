export interface RecipeForJsonLd {
  id: string;
  slug: string;
  title: string;
  description: string;
  metaDescription?: string | null;
  imageUrl?: string | null;
  category?: string | null;
  cuisine?: string | null;
  tags?: string[] | null;
  prepTimeMin?: number | null;
  cookTimeMin?: number | null;
  servings?: number | null;
  ingredientsText?: string | null;
  instructionsDetailed?: string | null;
}

const toIsoDuration = (minutes?: number | null): string | undefined => {
  if (!minutes || Number.isNaN(minutes) || minutes <= 0) return undefined;
  return `PT${Math.round(minutes)}M`;
};

const splitLines = (value?: string | null): string[] => {
  if (!value) return [];
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
};

export const buildRecipeJsonLd = (recipe: RecipeForJsonLd) => {
  const {
    slug,
    title,
    description,
    metaDescription,
    imageUrl,
    category,
    cuisine,
    tags,
    prepTimeMin,
    cookTimeMin,
    servings,
    ingredientsText,
    instructionsDetailed
  } = recipe;

  const siteUrl =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_SITE_URL
      : undefined;

  const url =
    siteUrl && slug ? `${siteUrl.replace(/\/$/, "")}/recettes/${slug}` : null;

  const totalMinutes =
    (prepTimeMin && prepTimeMin > 0 ? prepTimeMin : 0) +
    (cookTimeMin && cookTimeMin > 0 ? cookTimeMin : 0);

  const ingredientLines = splitLines(ingredientsText);
  const instructionLines = splitLines(instructionsDetailed);

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: title,
    description: metaDescription || description,
    image: imageUrl || undefined,
    recipeCategory: category || undefined,
    recipeCuisine: cuisine || undefined,
    keywords: tags && tags.length > 0 ? tags.join(", ") : undefined,
    recipeYield:
      typeof servings === "number" && servings > 0
        ? `${servings} portion(s)`
        : undefined,
    prepTime: toIsoDuration(prepTimeMin),
    cookTime: toIsoDuration(cookTimeMin),
    totalTime: toIsoDuration(totalMinutes),
    recipeIngredient: ingredientLines.length > 0 ? ingredientLines : undefined,
    recipeInstructions:
      instructionLines.length > 0
        ? instructionLines.map((line) => ({
            "@type": "HowToStep",
            text: line
          }))
        : undefined
  };

  if (url) {
    jsonLd.url = url;
  }

  return jsonLd;
};

export const validateRecipeJsonLd = (jsonLd: Record<string, unknown>) => {
  const issues: string[] = [];

  if (!jsonLd.name || typeof jsonLd.name !== "string") {
    issues.push("Champ 'name' manquant (titre de la recette).");
  }

  if (!jsonLd.description || typeof jsonLd.description !== "string") {
    issues.push("Champ 'description' manquant.");
  }

  if (!jsonLd.image) {
    issues.push("Aucune image définie (champ 'image').");
  }

  if (!jsonLd.recipeIngredient) {
    issues.push("Aucun ingrédient dans 'recipeIngredient'.");
  }

  if (!jsonLd.recipeInstructions) {
    issues.push("Aucune instruction dans 'recipeInstructions'.");
  }

  return issues;
};