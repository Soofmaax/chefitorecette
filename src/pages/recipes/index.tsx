import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { triggerEmbedding } from "@/lib/embeddings";

interface Recipe {
  id: string;
  title: string;
  slug: string;
  status: string;
  created_at: string | null;
  publish_at: string | null;
  embedding: unknown | null;
}

type FilterStatus = "all" | "withEmbedding" | "withoutEmbedding";

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
        .select(
          "id, title, slug, status, created_at, publish_at, embedding"
        )
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

  const statusLabel = (status: string) => {
    switch (status) {
      case "draft":
        return (
          <span className="rounded bg-slate-700/40 px-2 py-0.5 text-xs text-slate-200">
            Brouillon
          </span>
        );
      case "scheduled":
        return (
          <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">
            Programmé
          </span>
        );
      case "published":
        return (
          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
            Publié
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

  const embeddingLabel = (embedding: unknown | null) => {
    if (embedding) {
      return (
        <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
          Présent
        </span>
      );
    }
    return (
      <span className="rounded bg-slate-700/40 px-2 py-0.5 text-xs text-slate-300">
        Manquant
      </span>
    );
  };

  const filteredRecipes = useMemo(() => {
    if (filter === "all") return recipes;
    if (filter === "withEmbedding") {
      return recipes.filter((r) => r.embedding);
    }
    return recipes.filter((r) => !r.embedding);
  }, [recipes, filter]);

  const total = recipes.length;
  const withEmbeddingCount = recipes.filter((r) => r.embedding).length;
  const withoutEmbeddingCount = recipes.filter((r) => !r.embedding).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">
            Recettes RAG
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Suivi des recettes éditoriales qui alimentent votre système RAG.
          </p>
          {total > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              {withEmbeddingCount} / {total} recettes avec embedding •{" "}
              {withoutEmbeddingCount} sans embedding
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
              onClick={() => setFilter("withEmbedding")}
              className={`px-3 py-1.5 ${
                filter === "withEmbedding"
                  ? "bg-primary-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              Avec embedding
            </button>
            <button
              type="button"
              onClick={() => setFilter("withoutEmbedding")}
              className={`px-3 py-1.5 ${
                filter === "withoutEmbedding"
                  ? "bg-primary-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              Sans embedding
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
                <th className="px-4 py-2 text-left">Statut</th>
                <th className="px-4 py-2 text-left">Créée le</th>
                <th className="px-4 py-2 text-left">Publication</th>
                <th className="px-4 py-2 text-left">Embedding</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-slate-400"
                  >
                    <LoadingSpinner className="mr-2 inline-block" />
                    Chargement…
                  </td>
                </tr>
              ) : filteredRecipes.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    Aucune recette trouvée pour ce filtre.
                  </td>
                </tr>
              ) : (
                filteredRecipes.map((recipe) => (
                  <tr key={recipe.id}>
                    <td className="px-4 py-2 align-top">
                      <Link href={`/recipes/${recipe.id}`} legacyBehavior>
                        <a className="font-medium text-slate-100 hover:underline">
                          {recipe.title}
                        </a>
                      </Link>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {recipe.slug}
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top text-slate-400">
                      {statusLabel(recipe.status)}
                    </td>
                    <td className="px-4 py-2 align-top text-slate-400">
                      {recipe.created_at
                        ? new Date(recipe.created_at).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-4 py-2 align-top text-slate-400">
                      {recipe.publish_at
                        ? new Date(recipe.publish_at).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-4 py-2 align-top text-slate-400">
                      {embeddingLabel(recipe.embedding)}
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