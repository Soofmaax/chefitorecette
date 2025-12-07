import { RecipeFormValues } from "@/types/forms";

export type RecipeLike = {
  status?: string | null;
  image_url?: string | null;
  description?: string | null;
  ingredients_text?: string | null;
  instructions_detailed?: string | null;
  cultural_history?: string | null;
  techniques?: string | null;
  nutritional_notes?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  chef_tips?: string | null;
  difficulty_detailed?: string | null;
};

const isNonEmpty = (value: string | null | undefined) =>
  typeof value === "string" && value.trim() !== "";

/**
 * Renvoie la liste des champs éditoriaux/SEO manquants pour une recette.
 * Utilisé pour calculer la complétude (recette complète / à enrichir).
 */
export const getRecipeMissingFields = (recipe: RecipeLike): string[] => {
  const missing: string[] = [];

  if (recipe.status !== "published") {
    missing.push("Statut publié");
  }

  if (!isNonEmpty(recipe.image_url)) {
    missing.push("Image");
  }

  if (!isNonEmpty(recipe.description)) {
    missing.push("Description");
  }

  if (!isNonEmpty(recipe.ingredients_text)) {
    missing.push("Ingrédients");
  }

  if (!isNonEmpty(recipe.instructions_detailed)) {
    missing.push("Instructions détaillées");
  }

  if (!isNonEmpty(recipe.cultural_history)) {
    missing.push("Histoire / contexte culturel");
  }

  if (!isNonEmpty(recipe.techniques)) {
    missing.push("Techniques");
  }

  if (!isNonEmpty(recipe.nutritional_notes)) {
    missing.push("Notes nutritionnelles");
  }

  if (!isNonEmpty(recipe.meta_title)) {
    missing.push("Titre SEO");
  }

  if (!isNonEmpty(recipe.meta_description)) {
    missing.push("Description SEO");
  }

  if (!isNonEmpty(recipe.chef_tips) && !isNonEmpty(recipe.difficulty_detailed)) {
    missing.push("Astuces ou détails difficulté");
  }

  return missing;
};

/**
 * Liste les problèmes bloquants avant passage au statut `published`.
 *
 * Pour simplifier le flux d'édition centré sur le texte, on se limite
 * aux champs vraiment essentiels pour qu'une recette soit publiable.
 * Les éléments avancés RAG (ingrédients normalisés, étapes enrichies,
 * concepts scientifiques, SEO détaillé) deviennent optionnels.
 */
export const computePrePublishIssues = (
  values: RecipeFormValues,
  _options: {
    normalizedIngredientsCount: number;
    enrichedStepsCount: number;
    conceptsCount: number;
  }
): string[] => {
  const issues: string[] = [];

  // Ces champs sont déjà validés par le schema zod, mais on garde
  // une vérification défensive au cas où.
  if (!isNonEmpty(values.description)) {
    issues.push("Description obligatoire avant publication.");
  }
  if (!isNonEmpty(values.ingredients_text)) {
    issues.push("Ingrédients obligatoires avant publication.");
  }
  if (!isNonEmpty(values.instructions_detailed)) {
    issues.push("Instructions détaillées obligatoires avant publication.");
  }

  // On peut conserver l'exigence d'une image pour la qualité visuelle.
  if (!values.image_url) {
    issues.push("Image obligatoire avant publication.");
  }

  return issues;
};