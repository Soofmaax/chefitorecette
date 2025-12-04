import { useEffect, useState } from "react";
import { getDashboardStats, DashboardStats } from "@/lib/dashboard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

const DashboardPage = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const data = await getDashboardStats();
        if (mounted) {
          setStats(data);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <LoadingSpinner />
        <span className="ml-2 text-sm text-slate-400">
          Chargement des métriques…
        </span>
      </div>
    );
  }

  if (!stats) {
    return (
      <p className="text-sm text-red-300">
        Impossible de charger les statistiques du dashboard.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-50">
          Dashboard RAG
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Vue d’ensemble des recettes, articles, utilisateurs et intégrations
          RAG (Redis, S3, Vault).
        </p>
      </div>

      {/* Statistiques RAG principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="card px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Recettes
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-50">
            {stats.totalRecipes}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {stats.recipesWithVector} avec vecteur S3
          </p>
        </div>

        <div className="card px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Articles
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-50">
            {stats.totalArticles}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {stats.articlesWithVector} avec vecteur S3,{" "}
            {stats.articlesCached} en cache Redis
          </p>
        </div>

        <div className="card px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Utilisateurs
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-50">
            {stats.totalUsers}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Rôles gérés via la table user_profiles
          </p>
        </div>

        <div className="card px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            RAG &amp; Intégrations
          </p>
          <p className="mt-2 text-sm text-slate-200">
            Vecteurs externalisés dans S3, contenu et résultats de recherche
            mis en cache via Redis, métadonnées sensibles chiffrées dans Vault.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Les fonctions Edge Supabase orchestrent embeddings, cache, stockage
            et chiffrement.
          </p>
        </div>
      </div>

      {/* Métriques d'intégrations / performance */}
      {stats.performance && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="card px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Redis Cache
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-50">
              {Math.round(stats.performance.cacheHitRatio * 100)}%
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Taux de hit cache estimé (hitRatio)
            </p>
          </div>

          <div className="card px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              S3 Vectors
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-50">
              {stats.performance.s3StorageUsed}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Indicateur d’utilisation du stockage S3 (unité dépend de
              l’implémentation de l’Edge Function).
            </p>
          </div>

          <div className="card px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Vault Security
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-50">
              {stats.performance.encryptedData}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Objets chiffrés via Vault (rag_embeddings).
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;