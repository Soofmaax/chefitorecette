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
 * On se base sur RecipeFormValues pour ajouter des contraintes RAG.
 */
export const computePrePublishIssues = (
  values: RecipeFormValues,
  options: {
    normalizedIngredientsCount: number;
    enrichedStepsCount: number;
    conceptsCount: number;
  }
): string[] => {
  const issues: string[] = [];
  const missing = getRecipeMissingFields(values);

  if (missing.length > 0) {
    issues.push(
      `Champs éditoriaux/SEO manquants : ${missing.join(", ")}.`
    );
  }

  if (!values.image_url) {
    issues.push("Image obligatoire avant publication.");
  }

  if (options.normalizedIngredientsCount < 3) {
    issues.push("Au moins 3 ingrédients normalisés sont requis.");
  }

  if (options.enrichedStepsCount < 3) {
    issues.push("Au moins 3 étapes enrichies sont requises.");
  }

  if (options.conceptsCount < 1) {
    issues.push(
      "Au moins 1 concept scientifique lié est requis (base de connaissances)."
    );
  }

  return issues;
};