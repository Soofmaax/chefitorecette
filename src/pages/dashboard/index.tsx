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
          Vue d’ensemble des recettes, articles et utilisateurs gérés par le
          système RAG.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="card px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Recettes
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-50">
            {stats.totalRecipes}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {stats.recipesWithEmbedding} avec embedding
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
            {stats.articlesEnriched} enrichis (RAG complété)
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
            État RAG
          </p>
          <p className="mt-2 text-sm text-slate-200">
            Statistiques basées sur les colonnes{" "}
            <code className="rounded bg-slate-800/80 px-1">
              embedding
            </code>{" "}
            et{" "}
            <code className="rounded bg-slate-800/80 px-1">
              enrichment_status
            </code>
            .
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Les fonctions Edge Supabase pilotent les embeddings et
            enrichissements automatiques.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;