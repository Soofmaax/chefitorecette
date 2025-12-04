import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface RecipeRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  image_url: string | null;
  prep_time_min: number | null;
  cook_time_min: number | null;
  servings: number | null;
  difficulty: string | null;
  category: string | null;
  cuisine: string | null;
  tags: string[] | null;
  status: string | null;
  publish_at: string | null;
  ingredients_text: string | null;
  instructions_detailed: string | null;
  chef_tips: string | null;
  cultural_history: string | null;
  techniques: string | null;
  source_info: string | null;
  difficulty_detailed: string | null;
  nutritional_notes: string | null;
  meta_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  og_image_url: string | null;
}

interface RecipeWithMissing extends RecipeRow {
  missingFields: string[];
}

const FIELDS_TO_CHECK: { key: keyof RecipeRow; label: string }[] = [
  { key: "description", label: "Description" },
  { key: "image_url", label: "Image" },
  { key: "prep_time_min", label: "Temps de préparation" },
  { key: "cook_time_min", label: "Temps de cuisson" },
  { key: "servings", label: "Portions" },
  { key: "difficulty", label: "Difficulté" },
  { key: "category", label: "Catégorie" },
  { key: "cuisine", label: "Cuisine" },
  { key: "tags", label: "Tags" },
  { key: "ingredients_text", label: "Ingrédients" },
  { key: "instructions_detailed", label: "Instructions détaillées" },
  { key: "chef_tips", label: "Astuces du chef" },
  { key: "cultural_history", label: "Histoire / culture" },
  { key: "techniques", label: "Techniques" },
  { key: "source_info", label: "Source / crédits" },
  { key: "difficulty_detailed", label: "Détails sur la difficulté" },
  { key: "nutritional_notes", label: "Notes nutritionnelles" },
  { key: "meta_title", label: "Titre SEO" },
  { key: "meta_description", label: "Description SEO" },
  { key: "canonical_url", label: "URL canonique" },
  { key: "og_image_url", label: "Image Open Graph" }
];

const RecipesCompletionPage = () => {
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecipes = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("recipes")
        .select(
          "id, slug, title, description, image_url, prep_time_min, cook_time_min, servings, difficulty, category, cuisine, tags, status, publish_at, ingredients_text, instructions_detailed, chef_tips, cultural_history, techniques, source_info, difficulty_detailed, nutritional_notes, meta_title, meta_description, canonical_url, og_image_url"
        )
        .order("created_at", { ascending: false })
        .limit(500);

      if (!error && data) {
        setRecipes(data as RecipeRow[]);
      }

      setLoading(false);
    };

    fetchRecipes();
  }, []);

  const recipesWithMissing = useMemo<RecipeWithMissing[]>(() => {
    const result: RecipeWithMissing[] = recipes.map((r) => {
      const missingFields: string[] = [];

      for (const field of FIELDS_TO_CHECK) {
        const value = r[field.key];
        if (value === null || value === undefined) {
          missingFields.push(field.label);
          continue;
        }
        if (typeof value === "string" && value.trim() === "") {
          missingFields.push(field.label);
          continue;
        }
        if (Array.isArray(value) && value.length === 0) {
          missingFields.push(field.label);
        }
      }

      return { ...r, missingFields };
    });

    return result.filter((r) => r.missingFields.length > 0);
  }, [recipes]);

  const total = recipes.length;
  const incompleteCount = recipesWithMissing.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">
            Recettes à compléter
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Vue de travail pour repérer les champs manquants (NULL ou vides)
            dans vos recettes, afin de les enrichir progressivement.
          </p>
          {total > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              {incompleteCount} / {total} recettes ont encore des champs à
              compléter.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/recipes" legacyBehavior>
            <a>
              <Button variant="secondary">Retour aux recettes RAG</Button>
            </a>
          </Link>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-800 px-4 py-3 text-xs text-slate-400">
          {loading
            ? "Analyse des recettes…"
            : `${recipesWithMissing.length} recettes avec champs manquants (sur ${total})`}
        </div>

        <div className="max-h-[520px] overflow-auto text-sm">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-2 text-left">Recette</th>
                <th className="px-4 py-2 text-left">Statut</th>
                <th className="px-4 py-2 text-left">Cuisine</th>
                <th className="px-4 py-2 text-left">Catégorie</th>
                <th className="px-4 py-2 text-left">Champs manquants</th>
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
              ) : recipesWithMissing.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    Toutes les recettes sont complètes selon les critères
                    actuels.
                  </td>
                </tr>
              ) : (
                recipesWithMissing.map((recipe) => (
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
                    <td className="px-4 py-2 align-top text-xs text-slate-400">
                      {recipe.status}
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-slate-400">
                      {recipe.cuisine || "—"}
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-slate-400">
                      {recipe.category || "—"}
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-slate-200">
                      <div className="flex flex-wrap gap-1">
                        {recipe.missingFields.map((field) => (
                          <span
                            key={field}
                            className="rounded bg-red-500/10 px-2 py-0.5 text-[11px] text-red-200"
                          >
                            {field}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top text-right">
                      <Link href={`/recipes/${recipe.id}`} legacyBehavior>
                        <a>
                          <Button
                            type="button"
                            variant="secondary"
                            className="inline-flex items-center gap-2 text-xs"
                          >
                            Compléter
                          </Button>
                        </a>
                      </Link>
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

export default RecipesCompletionPage;