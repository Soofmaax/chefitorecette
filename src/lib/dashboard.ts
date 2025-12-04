import { supabase } from "./supabaseClient";

export interface DashboardStats {
  totalRecipes: number;
  recipesWithVector: number;
  totalArticles: number;
  articlesCached: number;
  articlesWithVector: number;
  totalUsers: number;
  redis?: any;
  s3?: any;
  vault?: any;
  performance?: {
    cacheHitRatio: number;
    s3StorageUsed: number;
    encryptedData: number;
  };
}

/**
 * Version optimisée du dashboard, intégrant les métriques RAG + intégrations.
 * On se base sur les colonnes :
 * - recipes: embedding_status, s3_vector_key
 * - posts: enrichment_status, s3_vector_key, cache_key
 */
export const getDashboardStats = async (): Promise<DashboardStats> => {
  const [recipes, articles, users, redisStats, s3Stats, vaultStats] =
    await Promise.all([
      supabase
        .from("recipes")
        .select("id, embedding_status, s3_vector_key", { count: "exact" }),
      supabase
        .from("posts")
        .select("id, enrichment_status, s3_vector_key, cache_key", {
          count: "exact"
        }),
      supabase.from("user_profiles").select("id, role", { count: "exact" }),
      supabase.functions.invoke("redis-wrapper", {
        body: { operation: "stats" }
      }),
      supabase.functions.invoke("s3-vectors-wrapper", {
        body: { operation: "storage_stats" }
      }),
      supabase.functions.invoke("vault-wrapper", {
        body: { operation: "encryption_stats" }
      })
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

  const redis = (redisStats.data as any) ?? null;
  const s3 = (s3Stats.data as any) ?? null;
  const vault = (vaultStats.data as any) ?? null;

  const performance = {
    cacheHitRatio: redis?.hitRatio ?? 0,
    s3StorageUsed: s3?.used ?? 0,
    encryptedData: vault?.encryptedCount ?? 0
  };

  return {
    totalRecipes,
    recipesWithVector,
    totalArticles,
    articlesCached,
    articlesWithVector,
    totalUsers,
    redis,
    s3,
    vault,
    performance
  };
};