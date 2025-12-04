"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  IngredientSelector,
  IngredientSelectorValue
} from "./IngredientSelector";

interface NormalizedIngredientRow {
  id?: string;
  ingredient_catalog_id: string | null;
  ingredient_label: string;
  quantity: string;
  unit: string;
  original_text: string;
  preparation_notes: string;
  is_optional: boolean;
  order_index: number;
}

interface RecipeIngredientsEditorProps {
  recipeId: string;
}

const COMMON_UNITS: string[] = [
  "g",
  "kg",
  "mg",
  "ml",
  "cl",
  "l",
  "c.à.c",
  "c.à.s",
  "pincée",
  "unité",
  "tranche",
  "cube",
  "bouquet"
];

interface DbRow {
  id: string;
  ingredient_catalog_id: string;
  quantity_value: number | null;
  quantity_unit: string | null;
  original_text: string;
  order_index: number;
  preparation_notes: string | null;
  is_optional: boolean | null;
  ingredients_catalog?: {
    display_name: string;
    canonical_name: string;
  } | null;
}

const fetchNormalizedIngredients = async (
  recipeId: string
): Promise<NormalizedIngredientRow[]> => {
  const { data, error } = await supabase
    .from("recipe_ingredients_normalized")
    .select(
      "id, ingredient_catalog_id, quantity_value, quantity_unit, original_text, order_index, preparation_notes, is_optional, ingredients_catalog(display_name, canonical_name)"
    )
    .eq("recipe_id", recipeId)
    .order("order_index", { ascending: true });

  if (error) {
    throw error;
  }

  const rows = (data as DbRow[]) ?? [];

  return rows.map((row, index) => ({
    id: row.id,
    ingredient_catalog_id: row.ingredient_catalog_id,
    ingredient_label:
      row.ingredients_catalog?.display_name ??
      row.ingredients_catalog?.canonical_name ??
      "",
    quantity:
      typeof row.quantity_value === "number"
        ? String(row.quantity_value)
        : "",
    unit: row.quantity_unit ?? "",
    original_text: row.original_text ?? "",
    preparation_notes: row.preparation_notes ?? "",
    is_optional: row.is_optional ?? false,
    order_index: row.order_index ?? index + 1
  }));
};

export const RecipeIngredientsEditor: React.FC<
  RecipeIngredientsEditorProps
> = ({ recipeId }) => {
  const queryClient = useQueryClient();
  const {
    data: rows,
    isLoading,
    isError
  } = useQuery<NormalizedIngredientRow[]>({
    queryKey: ["recipe-ingredients-normalized", recipeId],
    queryFn: () => fetchNormalizedIngredients(recipeId)
  });

  const [localRows, setLocalRows] = useState<NormalizedIngredientRow[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (rows) {
      setLocalRows(rows);
    }
  }, [rows]);

  const initialIds = useMemo(
    () => new Set((rows ?? []).map((r) => r.id).filter(Boolean) as string[]),
    [rows]
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const current = localRows;

      // Validation simple : ignorer les lignes sans ingrédient sélectionné
      const validRows = current.filter(
        (r) => r.ingredient_catalog_id && r.ingredient_label.trim() !== ""
      );

      // Déterminer les IDs à supprimer
      const currentIds = new Set(
        validRows.map((r) => r.id).filter(Boolean) as string[]
      );
      const idsToDelete = Array.from(initialIds).filter(
        (id) => !currentIds.has(id)
      );

      // Upsert des lignes valides
      const upsertPayload = validRows.map((r, index) => ({
        id: r.id,
        recipe_id: recipeId,
        ingredient_catalog_id: r.ingredient_catalog_id,
        quantity_value: r.quantity ? Number(r.quantity) : null,
        quantity_unit: r.unit || null,
        original_text: r.original_text || r.ingredient_label,
        order_index: index + 1,
        preparation_notes: r.preparation_notes || null,
        is_optional: r.is_optional
      }));

      if (upsertPayload.length > 0) {
        const { error: upsertError } = await supabase
          .from("recipe_ingredients_normalized")
          .upsert(upsertPayload, { onConflict: "id" });

        if (upsertError) {
          throw upsertError;
        }
      }

      if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from("recipe_ingredients_normalized")
          .delete()
          .in("id", idsToDelete);

        if (deleteError) {
          throw deleteError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["recipe-ingredients-normalized", recipeId]
      });
    }
  });

  const handleAddRow = () => {
    setLocalRows((prev) => [
      ...prev,
      {
        ingredient_catalog_id: null,
        ingredient_label: "",
        quantity: "",
        unit: "",
        original_text: "",
        preparation_notes: "",
        is_optional: false,
        order_index: prev.length + 1
      }
    ]);
  };

  const handleRemoveRow = (index: number) => {
    setLocalRows((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, patch: Partial<NormalizedIngredientRow>) => {
    setLocalRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (overIndex: number) => {
    if (draggedIndex === null || draggedIndex === overIndex) return;
    setLocalRows((prev) => {
      if (
        draggedIndex == null ||
        draggedIndex < 0 ||
        draggedIndex >= prev.length
      ) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(draggedIndex, 1);
      next.splice(overIndex, 0, moved);

      return next.map((row, index) => ({
        ...row,
        order_index: index + 1
      }));
    });
    setDraggedIndex(overIndex);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  if (isError) {
    return (
      <p className="text-xs text-red-300">
        Impossible de charger les ingrédients normalisés.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          Ingrédients structurés
        </h3>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            className="text-xs"
            onClick={handleAddRow}
          >
            Ajouter une ligne
          </Button>
          <Button
            type="button"
            variant="primary"
            className="inline-flex items-center gap-2 text-xs"
            disabled={saveMutation.isLoading}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isLoading && (
              <LoadingSpinner size="sm" className="text-slate-100" />
            )}
            <span>Enregistrer les ingrédients</span>
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-slate-500">
        Ces données alimentent la table{" "}
        <code className="rounded bg-slate-800/80 px-1">
          recipe_ingredients_normalized
        </code>{" "}
        (quantités, unités, lien avec le catalogue, ordre).
      </p>

      <div className="max-h-[360px] overflow-auto rounded-md border border-slate-800 bg-slate-950/40">
        <table className="min-w-full divide-y divide-slate-800 text-xs">
          <thead className="bg-slate-900/80 text-[11px] uppercase text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">Ordre</th>
              <th className="px-3 py-2 text-left">Ingrédient</th>
              <th className="px-3 py-2 text-left">Quantité</th>
              <th className="px-3 py-2 text-left">Unité</th>
              <th className="px-3 py-2 text-left">Texte original</th>
              <th className="px-3 py-2 text-left">Préparation</th>
              <th className="px-3 py-2 text-left">Opt.</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
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
            ) : localRows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-6 text-center text-slate-500"
                >
                  Aucun ingrédient normalisé pour cette recette. Ajoutez une
                  première ligne.
                </td>
              </tr>
            ) : (
              localRows.map((row, index) => (
                <tr
                  key={row.id ?? `tmp-${index}`}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    handleDragOver(index);
                  }}
                  onDragEnd={handleDragEnd}
                  className="bg-slate-950/60"
                >
                  <td className="px-3 py-2 align-top text-[11px] text-slate-400">
                    <span className="cursor-move select-none">☰</span>{" "}
                    {index + 1}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <IngredientSelector
                      value={
                        row.ingredient_catalog_id
                          ? {
                              id: row.ingredient_catalog_id,
                              label: row.ingredient_label
                            }
                          : null
                      }
                      onChange={(val: IngredientSelectorValue | null) =>
                        updateRow(index, {
                          ingredient_catalog_id: val?.id ?? null,
                          ingredient_label: val?.label ?? ""
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      type="text"
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      value={row.quantity}
                      onChange={(e) =>
                        updateRow(index, { quantity: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      type="text"
                      list="ingredient-unit-options"
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      value={row.unit}
                      onChange={(e) =>
                        updateRow(index, { unit: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      type="text"
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      value={row.original_text}
                      onChange={(e) =>
                        updateRow(index, { original_text: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      type="text"
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      value={row.preparation_notes}
                      onChange={(e) =>
                        updateRow(index, { preparation_notes: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-3 py-2 align-top text-center">
                    <input
                      type="checkbox"
                      className="h-3 w-3 accent-primary-500"
                      checked={row.is_optional}
                      onChange={(e) =>
                        updateRow(index, { is_optional: e.target.checked })
                      }
                    />
                  </td>
                  <td className="px-3 py-2 align-top text-right">
                    <Button
                      type="button"
                      variant="secondary"
                      className="text-[11px] text-red-300 hover:text-red-200"
                      onClick={() => handleRemoveRow(index)}
                    >
                      Supprimer
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <datalist id="ingredient-unit-options">
          {COMMON_UNITS.map((unit) => (
            <option key={unit} value={unit} />
          ))}
        </datalist>
      </div>
    </div>
  );
};