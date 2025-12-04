import { z } from "zod";

export const recipeSchema = z.object({
  title: z.string().min(3, "Titre trop court"),
  description: z.string().min(10, "Description trop courte"),
  ingredients: z.array(z.string()).min(1, "Au moins un ingrédient"),
  instructions: z.string().min(50, "Instructions trop courtes"),
  category: z.string().min(1, "Catégorie requise"),
  tags: z.array(z.string()).default([]),
  image_url: z
    .string()
    .url("URL invalide")
    .optional()
    .or(z.literal(""))
});

export type RecipeFormValues = z.infer<typeof recipeSchema>;

export const articleSchema = z.object({
  title: z.string().min(5, "Titre trop court"),
  excerpt: z.string().min(20, "Excerpt trop court"),
  content_html: z.string().min(100, "Contenu trop court"),
  status: z.enum(["draft", "published"]),
  category: z.string().min(1, "Catégorie requise"),
  tags: z.array(z.string()).default([])
});

export type ArticleFormValues = z.infer<typeof articleSchema>;

export const signInSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Mot de passe trop court")
});

export type SignInFormValues = z.infer<typeof signInSchema>;