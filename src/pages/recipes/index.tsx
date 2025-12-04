import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { triggerEmbedding } from "@/lib/embeddings";

interface Recipe {
  id: string;
  title: string;
  created_at: string;
  embedding: any | null;
}

const RecipesListPage = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecipes = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("recipes")
        .select("id, title, created_at, embedding")
        .order("created_at", { ascending: false })
        .limit(50);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">
            Recettes
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Liste simplifiée des recettes stockées dans Supabase.
          </p>
        </div>
        <Link href="/recipes/new" legacyBehavior>
          <a>
            <Button variant="primary">Nouvelle recette</Button>
          </a>
        </Link>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-800 px-4 py-3 text-xs text-slate-400">
          {loading
            ? "Chargement des recettes…"
            : `${recipes.length} recettes (limitées aux 50 plus récentes)`}
        </div>

        <div className="max-h-[480px] overflow-auto text-sm">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-2 text-left">Titre</th>
                <th className="px-4 py-2 text-left">Créée le</th>
                <th className="px-4 py-2 text-left">Embedding</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40">
              {loading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-slate-400"
                  >
                    <LoadingSpinner className="mr-2 inline-block" />
                    Chargement…
                  </td>
                </tr>
              ) : recipes.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    Aucune recette trouvée.
                  </td>
                </tr>
              ) : (
                recipes.map((recipe) => (
                  <tr key={recipe.id}>
                    <td className="px-4 py-2">
                      <span className="font-medium text-slate-100">
                        {recipe.title}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-400">
                      {recipe.created_at
                        ? new Date(recipe.created_at).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-400">
                      {recipe.embedding ? (
                        <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
                          Présent
                        </span>
                      ) : (
                        <span className="rounded bg-slate-700/40 px-2 py-0.5 text-xs text-slate-300">
                          Manquant
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
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