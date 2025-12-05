"use client";

import { useQuery } from "@tanstack/react-query";
import { getDashboardStats, DashboardStats } from "@/lib/dashboard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

const AdminDashboardPage = () => {
  const {
    data: stats,
    isLoading,
    isError
  } = useQuery<DashboardStats>({
    queryKey: ["admin-dashboard-stats"],
    queryFn: getDashboardStats
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <LoadingSpinner />
        <span className="ml-2 text-sm text-slate-400">
          Chargement des métriques…
        </span>
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <p className="text-sm text-red-300">
        Impossible de charger les statistiques du dashboard.
      </p>
    );
  }

  const totalRecipes = stats.totalRecipes ?? 0;
  const enrichedRecipes = stats.recipesWithVector ?? 0;

  const enrichmentRatio =
    totalRecipes > 0 ? Math.round((enrichedRecipes / totalRecipes) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-50">
          Dashboard admin – Recettes enrichies
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Vue d’ensemble des recettes, ingrédients, concepts scientifiques et
          intégrations RAG (embeddings, cache, audio).
        </p>
      </div>

      {/* Statistiques principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="card px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Recettes
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-50">
            {totalRecipes}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {stats.recipesWithVector} avec embedding
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
            {stats.articlesWithVector} avec embedding,{" "}
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
            Alertes similarité
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-50">
            {/* Placeholder, pourra être remplacé par une vraie requête */}
            —
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Alertes de similarité de recettes en attente de revue.
          </p>
        </div>
      </div>

      {/* Barres de progression de complétude */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Recettes avec embedding RAG
          </p>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <span>{enrichedRecipes} recettes enrichies</span>
            <span>{enrichmentRatio}%</span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-slate-800">
            <div
              className="h-2 rounded-full bg-primary-600"
              style={{ width: `${enrichmentRatio}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Approximation basée sur la présence d&apos;embeddings RAG.
          </p>
        </div>

        <div className="card px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Audio (placeholder)
          </p>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <span>À spécifier</span>
            <span>—</span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-slate-800">
            <div className="h-2 w-1/3 rounded-full bg-emerald-500" />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Progression de la couverture audio à implémenter selon les
            statistiques d&apos;usage.
          </p>
        </div>

        <div className="card px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Embeddings &amp; intégrations
          </p>
          <p className="mt-3 text-xs text-slate-400">
            Ce panneau résume l&apos;état des intégrations RAG (Redis, S3, Vault)
            lorsque les métriques avancées sont disponibles.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Les métriques détaillées (taux de hit cache, objets chiffrés, etc.)
            sont actuellement désactivées dans ce déploiement.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;