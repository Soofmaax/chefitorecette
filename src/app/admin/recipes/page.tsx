"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { triggerEmbedding } from "@/lib/embeddings";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface AdminRecipe {
  id: string;
  title: string;
  slug: string;
  status: string;
  category: string | null;
  cuisine: string | null;
  difficulty: string | null;
  created_at: string | null;
  publish_at: string | null;
  ingredients_text: string | null;
  instructions_detailed: string | null;
  chef_tips: string | null;
  cultural_history: string | null;
  techniques: string | null;
  difficulty_detailed: string | null;
  nutritional_notes: string | null;
  embedding: unknown | null;
}

type StatusFilter = "all" | "draft" | "scheduled" | "published";

const fetchRecipes = async (): Promise<AdminRecipe[]> => {
  const { data, error } = await supabase
    .from("recipes")
    .select(
      "id, title, slug, status, category, cuisine, difficulty, created_at, publish_at, ingredients_text, instructions_detailed, chef_tips, cultural_history, techniques, difficulty_detailed, nutritional_notes, embedding"
    )
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    throw error;
  }

  return (data as AdminRecipe[]) ?? [];
};

const computeMissingFields = (recipe: AdminRecipe): string[] => {
  const missing: string[] = [];
  const check = (
    key: keyof AdminRecipe,
    label: string,
    required: boolean = true
  ) => {
    const value = recipe[key];
    if (!required) return;
    if (value === null || value === undefined) {
      missing.push(label);
      return;
    }
    if (typeof value === "string" && value.trim() === "") {
      missing.push(label);
    }
  };

  check("description_detailed" as any, "Description", false); // placeholder
  check("image_url" as any, "Image", false); // placeholder
  check("ingredients_text", "Ingrédients");
  check("instructions_detailed", "Instructions");
  check("chef_tips", "Astuces du chef");
  check("cultural_history", "Histoire / culture");
  check("techniques", "Techniques");
  check("difficulty_detailed", "Détails difficulté");
  check("nutritional_notes", "Notes nutritionnelles");

  return missing;
};

const isEnrichedPremium = (recipe: AdminRecipe): boolean => {
  // Heuristique simple : notes nutritionnelles + histoire + techniques
  return (
    !!recipe.nutritional_notes &&
    recipe.nutritional_notes.trim() !== "" &&
    !!recipe.cultural_history &&
    recipe.cultural_history.trim() !== "" &&
    !!recipe.techniques &&
    recipe.techniques.trim() !== ""
  );
};

const AdminRecipesPage = () => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [cuisineFilter, setCuisineFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const {
    data: recipes,
    isLoading,
    isError
  } = useQuery<AdminRecipe[]>({
    queryKey: ["admin-recipes"],
    queryFn: fetchRecipes
  });

  const embeddingMutation = useMutation({
    mutationFn: async (id: string) => {
      await triggerEmbedding("recipe", id);
    }
  });

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          (recipes ?? [])
            .map((r) => r.category)
            .filter((c): c is string => !!c && c.trim() !== "")
        )
      ).sort(),
    [recipes]
  );

  const cuisines = useMemo(
    () =>
      Array.from(
        new Set(
          (recipes ?? [])
            .map((r) => r.cuisine)
            .filter((c): c is string => !!c && c.trim() !== "")
        )
      ).sort(),
    [recipes]
  );

  const filteredRecipes = useMemo(() => {
    if (!recipes) return [];

    return recipes.filter((recipe) => {
      if (
        statusFilter !== "all" &&
        recipe.status &&
        recipe.status !== statusFilter
      ) {
        return false;
      }

      if (
        difficultyFilter !== "all" &&
        recipe.difficulty &&
        recipe.difficulty !== difficultyFilter
      ) {
        return false;
      }

      if (
        categoryFilter !== "all" &&
        recipe.category &&
        recipe.category !== categoryFilter
      ) {
        return false;
      }

      if (
        cuisineFilter !== "all" &&
        recipe.cuisine &&
        recipe.cuisine !== cuisineFilter
      ) {
        return false;
      }

      if (search.trim()) {
        const needle = search.trim().toLowerCase();
        const haystack = `${recipe.title ?? ""} ${
          recipe.slug ?? ""
        } ${recipe.category ?? ""} ${recipe.cuisine ?? ""} ${
          recipe.ingredients_text ?? ""
        } ${recipe.instructions_detailed ?? ""}`.toLowerCase();

        if (!haystack.includes(needle)) {
          return false;
        }
      }

      return true;
    });
  }, [
    recipes,
    statusFilter,
    difficultyFilter,
    categoryFilter,
    cuisineFilter,
    search
  ]);

  const total = recipes?.length ?? 0;
  const withEmbeddingCount =
    recipes?.filter((r) => r.embedding != null).length ?? 0;

  if (isError) {
    return (
      <p className="text-sm text-red-300">
        Impossible de charger les recettes.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">
            Recettes – Mode premium
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Filtrez et enrichissez les recettes existantes avec des contenus
            premium (science, audio, SEO).
          </p>
          {total > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              {withEmbeddingCount} / {total} recettes avec embedding
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <input
            type="text"
            placeholder="Recherche plein texte (titre, description, ingrédients)…"
            className="w-full min-w-[260px] rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 md:w-80"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="flex flex-wrap gap-2">
            <select
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">Tous statuts</option>
              <option value="draft">Brouillon</option>
              <option value="scheduled">Programmé</option>
              <option value="published">Publié</option>
            </select>

            <select
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
            >
              <option value="all">Toutes difficultés</option>
              <option value="beginner">Débutant</option>
              <option value="intermediate">Intermédiaire</option>
              <option value="advanced">Avancé</option>
            </select>

            <select
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">Toutes catégories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={cuisineFilter}
              onChange={(e) => setCuisineFilter(e.target.value)}
            >
              <option value="all">Toutes cuisines</option>
              {cuisines.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-800 px-4 py-3 text-xs text-slate-400">
          {isLoading
            ? "Chargement des recettes…"
            : `${filteredRecipes.length} recettes affichées (sur ${total})`}
        </div>

        <div className="max-h-[560px] overflow-auto text-sm">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-2 text-left">Recette</th>
                <th className="px-4 py-2 text-left">Statut</th>
                <th className="px-4 py-2 text-left">Cuisine</th>
                <th className="px-4 py-2 text-left">Catégorie</th>
                <th className="px-4 py-2 text-left">Qualité</th>
                <th className="px-4 py-2 text-left">Embedding</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-slate-400"
                  >
                    <LoadingSpinner className="mr-2 inline-block" />
                    Chargement…
                  </td>
                </tr>
              ) : filteredRecipes.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    Aucune recette trouvée pour ces filtres.
                  </td>
                </tr>
              ) : (
                filteredRecipes.map((recipe) => {
                  const missing = computeMissingFields(recipe);
                  const enriched = isEnrichedPremium(recipe);

                  return (
                    <tr key={recipe.id}>
                      <td className="px-4 py-2 align-top">
                        <Link href={`/admin/recipes/${recipe.id}/edit`}>
                          <a className="font-medium text-slate-100 hover:underline">
                            {recipe.title}
                          </a>
                        </Link>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {recipe.slug}
                        </div>
                      </td>
                      <td className="px-4 py-2 align-top text-xs text-slate-400">
                        {recipe.status === "published" && (
                          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                            Publié
                          </span>
                        )}
                        {recipe.status === "draft" && (
                          <span className="rounded bg-slate-700/40 px-2 py-0.5 text-[11px] text-slate-200">
                            Brouillon
                          </span>
                        )}
                        {recipe.status === "scheduled" && (
                          <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200">
                            Programmé
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 align-top text-xs text-slate-400">
                        {recipe.cuisine || "—"}
                      </td>
                      <td className="px-4 py-2 align-top text-xs text-slate-400">
                        {recipe.category || "—"}
                      </td>
                      <td className="px-4 py-2 align-top text-xs text-slate-200">
                        <div className="flex flex-wrap gap-1">
                          {enriched && (
                            <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                              ✅ enrichie
                            </span>
                          )}
                          {!enriched && (
                            <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200">
                              ⚠️ à enrichir
                            </span>
                          )}
                          {missing.length > 0 && (
                            <span className="rounded bg-red-500/10 px-2 py-0.5 text-[11px] text-red-200">
                              {missing.length} champ(s) manquant(s)
                            </span>
                          )}
                          <span className="rounded bg-slate-700/40 px-2 py-0.5 text-[11px] text-slate-300">
                            🔊 audio : à définir
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2 align-top text-xs text-slate-400">
                        {recipe.embedding ? (
                          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                            Présent
                          </span>
                        ) : (
                          <span className="rounded bg-slate-700/40 px-2 py-0.5 text-[11px] text-slate-300">
                            Manquant
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 align-top text-right">
                        <div className="flex flex-col items-end gap-2">
                          <Link href={`/admin/recipes/${recipe.id}/edit`}>
                            <a>
                              <Button
                                variant="secondary"
                                className="inline-flex items-center gap-2 text-xs"
                              >
                                Éditer
                              </Button>
                            </a>
                          </Link>

                          <Button
                            type="button"
                            variant="secondary"
                            className="inline-flex items-center gap-2 text-xs"
                            onClick={() =>
                              embeddingMutation.mutate(recipe.id)
                            }
                            disabled={embeddingMutation.isLoading}
                          >
                            {embeddingMutation.isLoading && (
                              <LoadingSpinner size="sm" />
                            )}
                            <span>Recalculer embedding</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminRecipesPage;