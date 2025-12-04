import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { triggerEmbedding } from "@/lib/embeddings";

interface Recipe {
  id: string;
  title: string;
  created_at: string;
  embedding_status: string | null;
  s3_vector_key?: string | null;
}

type FilterStatus = "all" | "completed" | "pending" | "failed";

const RecipesListPage = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>("all");

  useEffect(() => {
    const fetchRecipes = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("recipes")
        .select("id, title, created_at, embedding_status, s3_vector_key")
        .order("created_at", { ascending: false })
        .limit(200);

      if (!error && data) {
        setRecipes(data as Recipe[]);
      }

      setLoading(false);
    };

    fetchRecipes();
  }, []);

  const handleRecomputeEmbedding = async (id: string) => {
    try {
      setUpdatingId(id);
      await triggerEmbedding("recipe", id);
      // eslint-disable-next-line no-console
      console.log("Embedding déclenché pour la recette", id);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      alert("Erreur lors du déclenchement de l’embedding.");
    } finally {
      setUpdatingId(null);
    }
  };

  const statusLabel = (status: string | null) => {
    switch (status) {
      case "completed":
        return (
          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
            Enrichie
          </span>
        );
      case "pending":
        return (
          <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">
            En attente
          </span>
        );
      case "failed":
        return (
          <span className="rounded bg-red-500/10 px-2 py-0.5 text-xs text-red-200">
            Échec
          </span>
        );
      default:
        return (
          <span className="rounded bg-slate-700/40 px-2 py-0.5 text-xs text-slate-300">
            Inconnu
          </span>
        );
    }
  };

  const filteredRecipes = useMemo(() => {
    if (filter === "all") return recipes;
    return recipes.filter((r) => r.embedding_status === filter);
  }, [recipes, filter]);

  const total = recipes.length;
  const completedCount = recipes.filter(
    (r) => r.embedding_status === "completed"
  ).length;
  const pendingCount = recipes.filter(
    (r) => r.embedding_status === "pending"
  ).length;
  const failedCount = recipes.filter(
    (r) => r.embedding_status === "failed"
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">
            Recettes RAG
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Suivi des recettes enrichies via le système RAG (embeddings +
            stockage S3).
          </p>
          {total > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              {completedCount} / {total} recettes enrichies • {pendingCount} en
              attente • {failedCount} en échec
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-slate-800 bg-slate-900/60 text-xs">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 ${
                filter === "all"
                  ? "bg-primary-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              Toutes
            </button>
            <button
              type="button"
              onClick={() => setFilter("completed")}
              className={`px-3 py-1.5 ${
                filter === "completed"
                  ? "bg-primary-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              Enrichies
            </button>
            <button
              type="button"
              onClick={() => setFilter("pending")}
              className={`px-3 py-1.5 ${
                filter === "pending"
                  ? "bg-primary-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              En attente
            </button>
            <button
              type="button"
              onClick={() => setFilter("failed")}
              className={`px-3 py-1.5 ${
                filter === "failed"
                  ? "bg-primary-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              Échec
            </button>
          </div>

          <Link href="/recipes/new" legacyBehavior>
            <a>
              <Button variant="primary">Nouvelle recette</Button>
            </a>
          </Link>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-800 px-4 py-3 text-xs text-slate-400">
          {loading
            ? "Chargement des recettes…"
            : `${filteredRecipes.length} recettes affichées (sur ${total}, limitées aux 200 plus récentes)`}
        </div>

        <div className="max-h-[520px] overflow-auto text-sm">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-2 text-left">Titre</th>
                <th className="px-4 py-2 text-left">Créée le</th>
                <th className="px-4 py-2 text-left">Statut embedding</th>
                <th className="px-4 py-2 text-left">Vecteur S3</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40">
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-slate-400"
                  >
                    <LoadingSpinner className="mr-2 inline-block" />
                    Chargement…
                  </td>
                </tr>
              ) : filteredRecipes.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    Aucune recette trouvée pour ce filtre.
                  </td>
                </tr>
              ) : (
                filteredRecipes.map((recipe) => (
                  <tr key={recipe.id}>
                    <td className="px-4 py-2 align-top">
                      <span className="font-medium text-slate-100">
                        {recipe.title}
                      </span>
                    </td>
                    <td className="px-4 py-2 align-top text-slate-400">
                      {recipe.created_at
                        ? new Date(recipe.created_at).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-4 py-2 align-top text-slate-400">
                      {statusLabel(recipe.embedding_status)}
                    </td>
                    <td className="px-4 py-2 align-top text-slate-400">
                      {recipe.s3_vector_key ? (
                        <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
                          {recipe.s3_vector_key}
                        </span>
                      ) : (
                        <span className="rounded bg-slate-700/40 px-2 py-0.5 text-xs text-slate-300">
                          Non stockée dans S3
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 align-top text-right">
                      <Button
                        type="button"
                        variant="secondary"
                        className="inline-flex items-center gap-2 text-xs"
                        onClick={() => handleRecomputeEmbedding(recipe.id)}
                        disabled={updatingId === recipe.id}
                      >
                        {updatingId === recipe.id && (
                          <LoadingSpinner size="sm" />
                        )}
                        <span>Recalculer embedding</span>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RecipesListPage;