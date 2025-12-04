import { supabase } from "./supabaseClient";
import { cacheContentInRedis, getCachedValue, hashCode } from "./integrations";

export interface SemanticSearchResult {
  id: string;
  score?: number;
  title?: string;
  titre?: string;
  excerpt?: string;
  description?: string;
  type?: string;
  [key: string]: any;
}

export interface SemanticSearchResponse {
  results: SemanticSearchResult[];
  source: "cache" | "search";
}

export const searchContent = async (
  query: string
): Promise<SemanticSearchResponse> => {
  const queryHash = hashCode(query);
  const cacheKey = `similarity:${queryHash}`;

  // 1. Vérifier le cache Redis
  try {
    const cached = await getCachedValue(cacheKey);
    if (cached) {
      const resultsArray = Array.isArray(cached) ? cached : [];
      return { results: resultsArray, source: "cache" };
    }
  } catch {
    // Si le cache échoue, on continue sur la recherche classique
  }

  // 2. Appeler la fonction de recherche sémantique
  const { data, error } = await supabase.functions.invoke(
    "post-similarity-search",
    {
      body: {
        query,
        search_in_s3: true,
        use_redis_cache: true
      }
    }
  );

  if (error) {
    throw error;
  }

  const results = (data as any)?.results ?? (Array.isArray(data) ? data : []);

  // 3. Mettre en cache les résultats
  try {
    await cacheContentInRedis(cacheKey, results);
  } catch {
    // En cas d'erreur de cache, on ne bloque pas la recherche
  }

  return { results, source: "search" };
};