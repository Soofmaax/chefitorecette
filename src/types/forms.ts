import { z } from "zod";

/**
 * Schéma de recette aligné sur la table public.recipes
 */
export const recipeSchema = z.object({
  title: z.string().min(3, "Titre trop court"),
  slug: z.string().optional(),
  description: z.string().min(10, "Description trop courte"),

  image_url: z
    .string()
    .url("URL invalide")
    .optional()
    .or(z.literal("")),

  prep_time_min: z.coerce
    .number()
    .int()
    .min(0, "Temps de préparation invalide"),
  cook_time_min: z.coerce
    .number()
    .int()
    .min(0, "Temps de cuisson invalide"),
  servings: z.coerce
    .number()
    .int()
    .min(1, "Nombre de portions invalide"),

  difficulty: z.enum(["beginner", "intermediate", "advanced"], {
    required_error: "Difficulté requise"
  }),
  category: z.string().min(1, "Catégorie requise"),
  cuisine: z.string().min(1, "Cuisine requise"),

  tags: z.array(z.string()).default([]),

  status: z.enum(["draft", "scheduled", "published"]).default("draft"),
  publish_at: z
    .string()
    .optional()
    .or(z.literal("")),

  ingredients_text: z
    .string()
    .min(1, "Liste d’ingrédients requise"),
  instructions_detailed: z
    .string()
    .min(1, "Instructions détaillées requises"),

  chef_tips: z.string().optional().or(z.literal("")),
  cultural_history: z.string().optional().or(z.literal("")),
  techniques: z.string().optional().or(z.literal("")),
  source_info: z.string().optional().or(z.literal("")),
  difficulty_detailed: z.string().optional().or(z.literal("")),
  nutritional_notes: z.string().optional().or(z.literal("")),

  meta_title: z.string().optional().or(z.literal("")),
  meta_description: z.string().optional().or(z.literal("")),
  canonical_url: z
    .string()
    .url("URL canonique invalide")
    .optional()
    .or(z.literal("")),
  og_image_url: z
    .string()
    .url("URL d’image Open Graph invalide")
    .optional()
    .or(z.literal(""))
});

export type RecipeFormValues = z.infer<typeof recipeSchema>;

export const articleSchema = z.object({
  title: z.string().min(5, "Titre trop court"),
  slug: z.string().optional(),
  excerpt: z.string().min(20, "Excerpt trop court"),
  content_html: z.string().min(100, "Contenu trop court"),
  status: z.enum(["draft", "published", "scheduled"]).default("draft"),
  category: z.string().min(1, "Catégorie requise"),
  tags: z.array(z.string()).default([]),
  cover_image_url: z
    .string()
    .url("URL d’image invalide")
    .optional()
    .or(z.literal("")),
  publish_at: z
    .string()
    .optional()
    .or(z.literal(""))
});

export type ArticleFormValues = z.infer<typeof articleSchema>;

export const signInSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Mot de passe trop court")
});

export type SignInFormValues = z.infer<typeof signInSchema>;