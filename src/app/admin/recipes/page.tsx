"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { triggerEmbedding } from "@/lib/embeddings";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface AdminRecipe {
  id: string;
  title: string;
  slug: string;
  status: string | null;
  description: string | null;
  image_url: string | null;
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
  meta_title: string | null;
  meta_description: string | null;
  embedding: unknown | null;
}

type StatusFilter = "all" | "draft" | "scheduled" | "published";

interface RecipesQueryParams {
  page: number;
  perPage: number;
  statusFilter: StatusFilter;
  difficultyFilter: string;
  categoryFilter: string;
  cuisineFilter: string;
  search: string;
  slugOrId: string;
}

type RagStatus = "complete" | "partial" | "missing";

type RagFilter =
  | "all"
  | "complete"
  | "partial"
  | "missing"
  | "no_ingredients"
  | "no_steps"
  | "no_concepts";

interface RagCounts {
  ingredients: number;
  steps: number;
  concepts: number;
}

interface RagInfo {
  status: RagStatus;
  hasIngredients: boolean;
  hasSteps: boolean;
  hasConcepts: boolean;
}

interface RecipeWithRagInfo {
  recipe: AdminRecipe;
  ragInfo: RagInfo;
}

interface RecipesQueryResult {
  items: AdminRecipe[];
  total: number;
}

interface CategoryRow {
  category: string | null;
}

interface CuisineRow {
  cuisine: string | null;
}

const isNonEmpty = (value: string | null | undefined) =>
  typeof value === "string" && value.trim() !== "";

const getPremiumMissing = (recipe: AdminRecipe): string[] => {
  const missing: string[] = [];

  if (recipe.status !== "published") {
    missing.push("Statut publié");
  }

  if (!isNonEmpty(recipe.image_url)) {
    missing.push("Image");
  }

  if (!isNonEmpty(recipe.description)) {
    missing.push("Description");
  }

  if (!isNonEmpty(recipe.ingredients_text)) {
    missing.push("Ingrédients");
  }

  if (!isNonEmpty(recipe.instructions_detailed)) {
    missing.push("Instructions détaillées");
  }

  if (!isNonEmpty(recipe.cultural_history)) {
    missing.push("Histoire / contexte culturel");
  }

  if (!isNonEmpty(recipe.techniques)) {
    missing.push("Techniques");
  }

  if (!isNonEmpty(recipe.nutritional_notes)) {
    missing.push("Notes nutritionnelles");
  }

  if (!isNonEmpty(recipe.meta_title)) {
    missing.push("Titre SEO");
  }

  if (!isNonEmpty(recipe.meta_description)) {
    missing.push("Description SEO");
  }

  if (
    !isNonEmpty(recipe.chef_tips) &&
    !isNonEmpty(recipe.difficulty_detailed)
  ) {
    missing.push("Astuces ou détails difficulté");
  }

  return missing;
};

const isCompleteRecipe = (recipe: AdminRecipe): boolean => {
  return getPremiumMissing(recipe).length === 0;
};

const computeMissingFields = (recipe: AdminRecipe): string[] => {
  return getPremiumMissing(recipe);
};

const fetchRecipes = async (
  params: RecipesQueryParams
): Promise<RecipesQueryResult> => {
  const {
    page,
    perPage,
    statusFilter,
    difficultyFilter,
    categoryFilter,
    cuisineFilter,
    search,
    slugOrId
  } = params;

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from("recipes")
    .select(
      "id, title, slug, status, description, image_url, category, cuisine, difficulty, created_at, publish_at, ingredients_text, instructions_detailed, chef_tips, cultural_history, techniques, difficulty_detailed, nutritional_notes, meta_title, meta_description, embedding",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  if (difficultyFilter !== "all") {
    query = query.eq("difficulty", difficultyFilter);
  }

  if (categoryFilter !== "all") {
    query = query.eq("category", categoryFilter);
  }

  if (cuisineFilter !== "all") {
    query = query.eq("cuisine", cuisineFilter);
  }

  const trimmedSlugOrId = slugOrId.trim();
  const trimmedSearch = search.trim();

  if (trimmedSlugOrId) {
    // Recherche exacte sur id ou slug pour accès rapide à une fiche précise.
    query = query.or(`id.eq.${trimmedSlugOrId},slug.eq.${trimmedSlugOrId}`);
  } else if (trimmedSearch) {
    const needle = `%${trimmedSearch}%`;
    query = query.or(
      [
        `title.ilike.${needle}`,
        `slug.ilike.${needle}`,
        `category.ilike.${needle}`,
        `cuisine.ilike.${needle}`,
        `ingredients_text.ilike.${needle}`,
        `instructions_detailed.ilike.${needle}`
      ].join(",")
    );
  }

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  return {
    items: ((data as AdminRecipe[]) ?? []).filter((r) => !!r.id),
    total: count ?? 0
  };
};

const fetchCategories = async (): Promise<string[]> => {
  const { data, error } = await supabase.from("recipes").select("category");

  if (error) {
    throw error;
  }

  const rows = (data as CategoryRow[]) ?? [];
  const values = rows
    .map((r) => r.category)
    .filter((c): c is string => !!c && c.trim() !== "");

  return Array.from(new Set(values)).sort();
};

const fetchCuisines = async (): Promise<string[]> => {
  const { data, error } = await supabase.from("recipes").select("cuisine");

  if (error) {
    throw error;
  }

  const rows = (data as CuisineRow[]) ?? [];
  const values = rows
    .map((r) => r.cuisine)
    .filter((c): c is string => !!c && c.trim() !== "");

  return Array.from(new Set(values)).sort();
};

const fetchRagCounts = async (
  recipeIds: string[]
): Promise<Record<string, RagCounts>> => {
  if (recipeIds.length === 0) {
    return {};
  }

  const baseMap: Record<string, RagCounts> = {};
  recipeIds.forEach((id) => {
    baseMap[id] = { ingredients: 0, steps: 0, concepts: 0 };
  });

  const [{ data: ingData, error: ingError }, { data: stepsData, error: stepsError }, { data: conceptsData, error: conceptsError }] =
    await Promise.all([
      supabase
        .from("recipe_ingredients_normalized")
        .select("recipe_id")
        .in("recipe_id", recipeIds),
      supabase
        .from("recipe_steps_enhanced")
        .select("recipe_id")
        .in("recipe_id", recipeIds),
      supabase
        .from("recipe_concepts")
        .select("recipe_id")
        .in("recipe_id", recipeIds)
    ]);

  if (ingError || stepsError || conceptsError) {
    throw ingError || stepsError || conceptsError;
  }

  (ingData as { recipe_id: string }[] | null)?.forEach((row) => {
    if (!baseMap[row.recipe_id]) {
      baseMap[row.recipe_id] = { ingredients: 0, steps: 0, concepts: 0 };
    }
    baseMap[row.recipe_id].ingredients += 1;
  });

  (stepsData as { recipe_id: string }[] | null)?.forEach((row) => {
    if (!baseMap[row.recipe_id]) {
      baseMap[row.recipe_id] = { ingredients: 0, steps: 0, concepts: 0 };
    }
    baseMap[row.recipe_id].steps += 1;
  });

  (conceptsData as { recipe_id: string }[] | null)?.forEach((row) => {
    if (!baseMap[row.recipe_id]) {
      baseMap[row.recipe_id] = { ingredients: 0, steps: 0, concepts: 0 };
    }
    baseMap[row.recipe_id].concepts += 1;
  });

  return baseMap;
};

const computeRagStatus = (
  recipe: AdminRecipe,
  counts: RagCounts | undefined
): RagInfo => {
  const hasIngredients = (counts?.ingredients ?? 0) > 0;
  const hasSteps = (counts?.steps ?? 0) > 0;
  const hasConcepts = (counts?.concepts ?? 0) > 0;
  const seoComplete =
    isNonEmpty(recipe.meta_title) && isNonEmpty(recipe.meta_description);

  const dimensions = [hasIngredients, hasSteps, hasConcepts, seoComplete];
  const filled = dimensions.filter(Boolean).length;
  const totalDims = dimensions.length;

  let status: RagStatus = "missing";
  if (filled === 0) {
    status = "missing";
  } else if (filled === totalDims) {
    status = "complete";
  } else {
    status = "partial";
  }

  return { status, hasIngredients, hasSteps, hasConcepts };
};

const AdminRecipesPage = () => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [cuisineFilter, setCuisineFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [slugOrId, setSlugOrId] = useState("");
  const [ragFilter, setRagFilter] = useState<RagFilter>("all");
  const [page, setPage] = useState<number>(1);
  const perPage = 50;

  // Reset page when filtres, recherche ou filtre RAG changent
  useEffect(() => {
    setPage(1);
  }, [
    statusFilter,
    difficultyFilter,
    categoryFilter,
    cuisineFilter,
    search,
    slugOrId,
    ragFilter
  ]);

  const {
    data,
    isLoading,
    isError
  } = useQuery<RecipesQueryResult, Error>({
    queryKey: [
      "admin-recipes",
      {
        page,
        perPage,
        statusFilter,
        difficultyFilter,
        categoryFilter,
        cuisineFilter,
        search,
        slugOrId
      }
    ],
    queryFn: () =>
      fetchRecipes({
        page,
        perPage,
        statusFilter,
        difficultyFilter,
        categoryFilter,
        cuisineFilter,
        search,
        slugOrId
      }),
    placeholderData: keepPreviousData
  });

  const { data: categories = [] } = useQuery<string[], Error>({
    queryKey: ["admin-recipes-categories"],
    queryFn: fetchCategories
  });

  const { data: cuisines = [] } = useQuery<string[], Error>({
    queryKey: ["admin-recipes-cuisines"],
    queryFn: fetchCuisines
  });

  const recipes = useMemo<AdminRecipe[]>(
    () => (data?.items ?? []).filter((r: AdminRecipe) => !!r.id),
    [data]
  );
  const total = data?.total ?? 0;
  const totalPages = total > 0 ? Math.ceil(total / perPage) : 1;
  const recipeIds = useMemo<string[]>(() => recipes.map((r) => r.id), [recipes]);

  const {
    data: ragCountsData,
    isLoading: isLoadingRag
  } = useQuery<Record<string, RagCounts>, Error>({
    queryKey: ["admin-recipes-rag", recipeIds],
    queryFn: () => fetchRagCounts(recipeIds),
    enabled: recipeIds.length > 0,
    placeholderData: keepPreviousData
  });

  const ragCounts = useMemo<Record<string, RagCounts>>(
    () => ragCountsData ?? {},
    [ragCountsData]
  );

  const recipesWithRag = useMemo<RecipeWithRagInfo[]>(
    () =>
      recipes.map((recipe) => {
        const counts = ragCounts[recipe.id];
        const ragInfo = computeRagStatus(recipe, counts);
        return { recipe, ragInfo };
      }),
    [recipes, ragCounts]
  );

  const filteredRecipes = useMemo<RecipeWithRagInfo[]>(() => {
    return recipesWithRag.filter(({ ragInfo }) => {
      const { status, hasIngredients, hasSteps, hasConcepts } = ragInfo;

      if (ragFilter === "complete" && status !== "complete") return false;
      if (ragFilter === "partial" && status !== "partial") return false;
      if (ragFilter === "missing" && status !== "missing") return false;
      if (ragFilter === "no_ingredients" && hasIngredients) return false;
      if (ragFilter === "no_steps" && hasSteps) return false;
      if (ragFilter === "no_concepts" && hasConcepts) return false;

      return true;
    });
  }, [recipesWithRag, ragFilter]);

  const embeddingMutation = useMutation({
    mutationFn: async (id: string) => {
      await triggerEmbedding("recipe", id);
    }
  });

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
          Recettes – Mode enrichi
        </h1>
          <p className="mt-1 text-sm text-slate-400">
            Filtrez et enrichissez les recettes existantes avec des contenus
            premium (science, audio, SEO).
          </p>
          {total > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              {recipes.length} recette(s) sur cette page (sur {total} au total)
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <input
              type="text"
              placeholder="Recherche plein texte (titre, description, ingrédients)…"
              className="w-full min-w-[260px] rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 md:w-80"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <input
              type="text"
              placeholder="ID ou slug exact…"
              className="w-full min-w-[220px] rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 md:w-64"
              value={slugOrId}
              onChange={(e) => setSlugOrId(e.target.value)}
            />
          </div>

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

            <select
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={ragFilter}
              onChange={(e) => setRagFilter(e.target.value as RagFilter)}
            >
              <option value="all">Toutes structures RAG</option>
              <option value="complete">RAG complet</option>
              <option value="partial">RAG partiel</option>
              <option value="missing">RAG absent</option>
              <option value="no_ingredients">
                Sans ingrédients normalisés
              </option>
              <option value="no_steps">Sans étapes enrichies</option>
              <option value="no_concepts">Sans concepts scientifiques</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 text-xs text-slate-400">
          <div>
            {isLoading
              ? "Chargement des recettes…"
              : `${filteredRecipes.length} recette(s) affichée(s) sur cette page (sur ${total} au total)`}
            {isLoadingRag && !isLoading && (
              <span className="ml-2 text-[11px] text-slate-500">
                (calcul RAG…)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-100 disabled:opacity-40"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
            >
              ◀ Page précédente
            </button>
            <span className="text-[11px] text-slate-400">
              Page {page} / {totalPages || 1}
            </span>
            <button
              type="button"
              className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-100 disabled:opacity-40"
              onClick={() =>
                setPage((p) => (p < totalPages ? p + 1 : p))
              }
              disabled={page >= totalPages || isLoading || total === 0}
            >
              Page suivante ▶
            </button>
          </div>
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
                <th className="px-4 py-2 text-left">RAG</th>
                <th className="px-4 py-2 text-left">Embedding</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-6 text-center text-slate-400"
                  >
                    <LoadingSpinner className="mr-2 inline-block" />
                    Chargement…
                  </td>
                </tr>
              ) : filteredRecipes.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    Aucune recette trouvée pour ces filtres.
                  </td>
                </tr>
              ) : (
                filteredRecipes.map(({ recipe, ragInfo }) => {
                  const missing = computeMissingFields(recipe);
                  const enriched = isEnrichedPremium(recipe);
                  const ragLabel =
                    ragInfo.status === "complete"
                      ? "RAG complet"
                      : ragInfo.status === "partial"
                      ? "RAG partiel"
                      : "RAG absent";

                  return (
                    <tr key={recipe.id}>
                      <td className="px-4 py-2 align-top">
                        <Link
                          href={`/admin/recipes/${recipe.id}/edit`}
                          className="font-medium text-slate-100 hover:underline"
                        >
                          {recipe.title}
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
                      <td className="px-4 py-2 align-top text-xs text-slate-200">
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] ${
                            ragInfo.status === "complete"
                              ? "bg-emerald-500/10 text-emerald-300"
                              : ragInfo.status === "partial"
                              ? "bg-amber-500/10 text-amber-200"
                              : "bg-slate-700/40 text-slate-300"
                          }`}
                        >
                          {ragLabel}
                        </span>
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
                            <Button
                              variant="secondary"
                              className="inline-flex items-center gap-2 text-xs"
                            >
                              Éditer
                            </Button>
                          </Link>

                          <Button
                            type="button"
                            variant="secondary"
                            className="inline-flex items-center gap-2 text-xs"
                            onClick={() =>
                              embeddingMutation.mutate(recipe.id)
                            }
                            disabled={embeddingMutation.isPending}
                          >
                            {embeddingMutation.isPending && (
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