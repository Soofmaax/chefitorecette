import { supabase } from "./supabaseClient";

export interface DashboardStats {
  totalRecipes: number;
  recipesWithVector: number;
  totalArticles: number;
  articlesCached: number;
  articlesWithVector: number;
  totalUsers: number;
}

/**
 * Dashboard simplifié : statistiques principales sans dépendre des Edge Functions.
 * On se base sur les colonnes :
 * - recipes: embedding_status, s3_vector_key
 * - posts: enrichment_status, s3_vector_key, cache_key
 */
export const getDashboardStats = async (): Promise<DashboardStats> => {
  const [recipes, articles, users] = await Promise.all([
    supabase
      .from("recipes")
      .select("id, embedding_status, s3_vector_key", { count: "exact" }),
    supabase
      .from("posts")
      .select("id, enrichment_status, s3_vector_key, cache_key", {
        count: "exact"
      }),
    supabase.from("user_profiles").select("id, role", { count: "exact" })
  ]);

  const totalRecipes = recipes.count ?? 0;
  const recipesWithVector =
    recipes.data?.filter((r: any) => r.s3_vector_key).length ?? 0;

  const totalArticles = articles.count ?? 0;
  const articlesCached =
    articles.data?.filter((a: any) => a.cache_key).length ?? 0;
  const articlesWithVector =
    articles.data?.filter((a: any) => a.s3_vector_key).length ?? 0;

  const totalUsers = users.count ?? 0;

  return {
    totalRecipes,
    recipesWithVector,
    totalArticles,
    articlesCached,
    articlesWithVector,
    totalUsers
  };
};