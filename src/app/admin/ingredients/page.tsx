"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface IngredientCatalog {
  id: string;
  canonical_name: string;
  display_name: string;
  category: string;
  scientific_name: string | null;
  audio_key: string | null;
  usage_count: number | null;
}

const fetchIngredientsCatalog = async (): Promise<IngredientCatalog[]> => {
  const { data, error } = await supabase
    .from("ingredients_catalog")
    .select(
      "id, canonical_name, display_name, category, scientific_name, audio_key, usage_count"
    )
    .order("display_name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data as IngredientCatalog[]) ?? [];
};

const AdminIngredientsPage = () => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<IngredientCatalog | null>(null);
  const [form, setForm] = useState<Partial<IngredientCatalog>>({});

  const {
    data: ingredients,
    isLoading,
    isError
  } = useQuery<IngredientCatalog[]>({
    queryKey: ["ingredients-catalog"],
    queryFn: fetchIngredientsCatalog
  });

  const upsertMutation = useMutation({
    mutationFn: async (payload: Partial<IngredientCatalog>) => {
      const base = {
        canonical_name: payload.canonical_name,
        display_name: payload.display_name,
        category: payload.category,
        scientific_name: payload.scientific_name || null,
        audio_key: payload.audio_key || null
      };

      if (payload.id) {
        const { error } = await supabase
          .from("ingredients_catalog")
          .update(base)
          .eq("id", payload.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ingredients_catalog")
          .insert([base]);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingredients-catalog"] });
      setEditing(null);
      setForm({});
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ingredients_catalog")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingredients-catalog"] });
    }
  });

  const startCreate = () => {
    setEditing(null);
    setForm({
      canonical_name: "",
      display_name: "",
      category: ""
    });
  };

  const startEdit = (ingredient: IngredientCatalog) => {
    setEditing(ingredient);
    setForm({ ...ingredient });
  };

  const handleChange = (key: keyof IngredientCatalog, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!form.canonical_name || !form.display_name || !form.category) {
      return;
    }
    await upsertMutation.mutateAsync(form);
  };

  if (isError) {
    return (
      <p className="text-sm text-red-300">
        Impossible de charger le catalogue des ingrédients.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">
            Bibliothèque d&apos;ingrédients
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Gérez le catalogue d&apos;ingrédients structurés utilisé pour la
            normalisation des recettes (quantités, audio, usages scientifiques).
          </p>
        </div>
        <div>
          <Button type="button" variant="primary" onClick={startCreate}>
            Nouvel ingrédient
          </Button>
        </div>
      </div>

      {/* Formulaire de création / édition */}
      {(editing || form.canonical_name) && (
        <div className="card space-y-4 px-4 py-4">
          <h2 className="text-sm font-semibold text-slate-100">
            {editing ? "Modifier l’ingrédient" : "Nouvel ingrédient"}
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label htmlFor="canonical_name">Nom canonique</label>
              <input
                id="canonical_name"
                type="text"
                className="mt-1 w-full"
                value={form.canonical_name ?? ""}
                onChange={(e) =>
                  handleChange("canonical_name", e.target.value)
                }
              />
            </div>
            <div>
              <label htmlFor="display_name">Nom affiché</label>
              <input
                id="display_name"
                type="text"
                className="mt-1 w-full"
                value={form.display_name ?? ""}
                onChange={(e) =>
                  handleChange("display_name", e.target.value)
                }
              />
            </div>
            <div>
              <label htmlFor="category">Catégorie</label>
              <input
                id="category"
                type="text"
                className="mt-1 w-full"
                value={form.category ?? ""}
                onChange={(e) => handleChange("category", e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="scientific_name">Nom scientifique</label>
              <input
                id="scientific_name"
                type="text"
                className="mt-1 w-full"
                value={form.scientific_name ?? ""}
                onChange={(e) =>
                  handleChange("scientific_name", e.target.value)
                }
              />
            </div>

            <div>
              <label htmlFor="audio_key">Clé audio (optionnel)</label>
              <input
                id="audio_key"
                type="text"
                className="mt-1 w-full"
                value={form.audio_key ?? ""}
                onChange={(e) => handleChange("audio_key", e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-500">
                Fait le lien avec une entrée de la table&nbsp;
                <code className="rounded bg-slate-800/80 px-1">
                  audio_library
                </code>
                .
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="primary"
                onClick={handleSubmit}
                disabled={upsertMutation.isLoading}
                className="inline-flex items-center gap-2"
              >
                {upsertMutation.isLoading && (
                  <LoadingSpinner size="sm" className="text-slate-100" />
                )}
                <span>Enregistrer</span>
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="text-xs"
                onClick={() => {
                  setEditing(null);
                  setForm({});
                }}
              >
                Annuler
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tableau des ingrédients */}
      <div className="card overflow-hidden">
        <div className="border-b border-slate-800 px-4 py-3 text-xs text-slate-400">
          {isLoading
            ? "Chargement des ingrédients…"
            : `${ingredients?.length ?? 0} ingrédients dans le catalogue.`}
        </div>

        <div className="max-h-[560px] overflow-auto text-sm">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-2 text-left">Nom</th>
                <th className="px-4 py-2 text-left">Catégorie</th>
                <th className="px-4 py-2 text-left">Nom scientifique</th>
                <th className="px-4 py-2 text-left">Audio</th>
                <th className="px-4 py-2 text-right">Usage</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-slate-400"
                  >
                    <LoadingSpinner className="mr-2 inline-block" />
                    Chargement…
                  </td>
                </tr>
              ) : !ingredients || ingredients.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    Aucun ingrédient dans le catalogue.
                  </td>
                </tr>
              ) : (
                ingredients.map((ingredient) => (
                  <tr key={ingredient.id}>
                    <td className="px-4 py-2 align-top">
                      <div className="font-medium text-slate-100">
                        {ingredient.display_name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {ingredient.canonical_name}
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-slate-400">
                      {ingredient.category}
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-slate-400">
                      {ingredient.scientific_name || "—"}
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-slate-400">
                      {ingredient.audio_key ? (
                        <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                          {ingredient.audio_key}
                        </span>
                      ) : (
                        <span className="rounded bg-slate-700/40 px-2 py-0.5 text-[11px] text-slate-300">
                          Aucun
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 align-top text-right text-xs text-slate-400">
                      {ingredient.usage_count ?? 0}
                    </td>
                    <td className="px-4 py-2 align-top text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="text-xs"
                          onClick={() => startEdit(ingredient)}
                        >
                          Éditer
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="text-xs text-red-300 hover:text-red-200"
                          disabled={deleteMutation.isLoading}
                          onClick={() => {
                            // eslint-disable-next-line no-alert
                            const ok = window.confirm(
                              `Supprimer l'ingrédient "${ingredient.display_name}" ?`
                            );
                            if (!ok) return;
                            deleteMutation.mutate(ingredient.id);
                          }}
                        >
                          Supprimer
                        </Button>
                      </div>
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

export default AdminIngredientsPage;