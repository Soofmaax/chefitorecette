import { supabase } from "./supabaseClient";

export interface DashboardStats {
  totalRecipes: number;
  recipesWithEmbedding: number;
  totalArticles: number;
  articlesEnriched: number;
  totalUsers: number;
}

export const getDashboardStats = async (): Promise<DashboardStats> => {
  const [recipes, articles, users] = await Promise.all([
    supabase.from("recipes").select("id, embedding", { count: "exact" }),
    supabase
      .from("posts")
      .select("id, enrichment_status", { count: "exact" }),
    supabase.from("user_profiles").select("id, role", { count: "exact" })
  ]);

  const totalRecipes = recipes.count ?? 0;
  const recipesWithEmbedding =
    recipes.data?.filter((r: any) => r.embedding != null).length ?? 0;

  const totalArticles = articles.count ?? 0;
  const articlesEnriched =
    articles.data?.filter((a: any) => a.enrichment_status === "completed")
      .length ?? 0;

  const totalUsers = users.count ?? 0;

  return {
    totalRecipes,
    recipesWithEmbedding,
    totalArticles,
    articlesEnriched,
    totalUsers
  };
};