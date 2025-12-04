"use client";

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface Recipe {
  id: string;
  title: string;
  slug: string;
}

interface SimilarityAlert {
  id: string;
  new_recipe_id: string;
  similar_recipe_id: string;
  similarity_score: number;
  status: string | null;
  resolution: string | null;
  created_at: string | null;
}

interface AlertWithRecipes extends SimilarityAlert {
  newRecipe?: Recipe;
  similarRecipe?: Recipe;
}

const fetchAlertsWithRecipes = async (): Promise<AlertWithRecipes[]> => {
  const { data: alerts, error } = await supabase
    .from("recipe_similarity_alerts")
    .select(
      "id, new_recipe_id, similar_recipe_id, similarity_score, status, resolution, created_at"
    )
    .in("status", ["pending", "reviewing"])
    .order("similarity_score", { ascending: false })
    .limit(200);

  if (error) {
    throw error;
  }

  const alertsData = (alerts as SimilarityAlert[]) ?? [];
  if (alertsData.length === 0) {
    return [];
  }

  const recipeIds = Array.from(
    new Set(
      alertsData.flatMap((a) => [a.new_recipe_id, a.similar_recipe_id])
    )
  );

  const { data: recipes, error: recipesError } = await supabase
    .from("recipes")
    .select("id, title, slug")
    .in("id", recipeIds);

  if (recipesError) {
    throw recipesError;
  }

  const recipeMap = new Map<string, Recipe>();
  (recipes as Recipe[]).forEach((r) => {
    recipeMap.set(r.id, r);
  });

  return alertsData.map((alert) => ({
    ...alert,
    newRecipe: recipeMap.get(alert.new_recipe_id),
    similarRecipe: recipeMap.get(alert.similar_recipe_id)
  }));
};

const AdminAlertsPage = () => {
  const queryClient = useQueryClient();

  const {
    data: alerts,
    isLoading,
    isError
  } = useQuery<AlertWithRecipes[]>({
    queryKey: ["similarity-alerts"],
    queryFn: fetchAlertsWithRecipes
  });

  const resolveAsDifferent = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from("recipe_similarity_alerts")
        .update({
          status: "resolved",
          resolution: "different"
        })
        .eq("id", alertId);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["similarity-alerts"] });
    }
  });

  const resolveAsParentChild = useMutation({
    mutationFn: async (params: {
      alertId: string;
      parentId: string;
      childId: string;
    }) => {
      const { alertId, parentId, childId } = params;

      const { error: relError } = await supabase
        .from("recipe_relationships")
        .insert([
          {
            parent_recipe_id: parentId,
            child_recipe_id: childId,
            relationship_type: "variant"
          }
        ]);

      if (relError) {
        throw relError;
      }

      const { error: alertError } = await supabase
        .from("recipe_similarity_alerts")
        .update({
          status: "resolved",
          resolution: "parent_child"
        })
        .eq("id", alertId);

      if (alertError) {
        throw alertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["similarity-alerts"] });
    }
  });

  const mergeRecipes = useMutation({
    mutationFn: async (params: {
      alertId: string;
      canonicalId: string;
      duplicateId: string;
    }) => {
      const res = await fetch("/api/recipes/merge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(params)
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(
          payload?.error ?? "Erreur lors de la fusion des recettes."
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["similarity-alerts"] });
    }
  });

  const pendingCount = alerts?.length ?? 0;

  const sortedAlerts = useMemo(() => {
    if (!alerts) return [];
    return alerts
      .slice()
      .sort((a, b) => b.similarity_score - a.similarity_score);
  }, [alerts]);

  if (isError) {
    return (
      <p className="text-sm text-red-300">
        Impossible de charger les alertes de similarité.
      </p>
    );
  }

  const renderAlerts = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-10">
          <LoadingSpinner />
          <span className="ml-2 text-sm text-slate-400">
            Chargement des alertes…
          </span>
        </div>
      );
    }

    if (!sortedAlerts.length) {
      return (
        <p className="text-sm text-slate-400">
          Aucune alerte de similarité en attente. Tout est à jour.
        </p>
      );
    }

    return sortedAlerts.map((alert) => {
      const newRecipe = alert.newRecipe;
      const similarRecipe = alert.similarRecipe;

      return (
        <div
          key={alert.id}
          className="card flex flex-col gap-4 px-4 py-4 md:flex-row"
        >
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>
                Score de similarité :{" "}
                <span className="font-semibold text-slate-100">
                  {alert.similarity_score.toFixed(3)}
                </span>
              </span>
              <span>
                Créée le{" "}
                {alert.created_at
                  ? new Date(alert.created_at).toLocaleString()
                  : "—"}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                  Nouvelle recette
                </h2>
                {newRecipe ? (
                  <div className="space-y-1">
                    <Link
                      href={`/admin/recipes/${newRecipe.id}/edit`}
                      className="text-sm font-medium text-slate-100 hover:underline"
                    >
                      {newRecipe.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {newRecipe.slug}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Recette introuvable.
                  </p>
                )}
              </div>

              <div>
                <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-300">
                  Recette similaire
                </h2>
                {similarRecipe ? (
                  <div className="space-y-1">
                    <Link
                      href={`/admin/recipes/${similarRecipe.id}/edit`}
                      className="text-sm font-medium text-slate-100 hover:underline"
                    >
                      {similarRecipe.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {similarRecipe.slug}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Recette introuvable.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col justify-between gap-3 md:w-64">
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="secondary"
                className="text-xs"
                disabled={
                  resolveAsParentChild.isLoading ||
                  resolveAsDifferent.isLoading ||
                  mergeRecipes.isLoading ||
                  !newRecipe ||
                  !similarRecipe
                }
                onClick={() => {
                  if (!newRecipe || !similarRecipe) return;
                  resolveAsParentChild.mutate({
                    alertId: alert.id,
                    parentId: similarRecipe.id,
                    childId: newRecipe.id
                  });
                }}
              >
                Marquer : nouvelle = variante de la recette existante
              </Button>

              <Button
                type="button"
                variant="secondary"
                className="text-xs"
                disabled={
                  resolveAsParentChild.isLoading ||
                  resolveAsDifferent.isLoading ||
                  mergeRecipes.isLoading ||
                  !newRecipe ||
                  !similarRecipe
                }
                onClick={() => {
                  if (!newRecipe || !similarRecipe) return;
                  resolveAsParentChild.mutate({
                    alertId: alert.id,
                    parentId: newRecipe.id,
                    childId: similarRecipe.id
                  });
                }}
              >
                Marquer : existante = variante de la nouvelle
              </Button>

              <Button
                type="button"
                variant="secondary"
                className="text-xs text-red-300 hover:text-red-200"
                disabled={
                  resolveAsParentChild.isLoading ||
                  resolveAsDifferent.isLoading ||
                  mergeRecipes.isLoading
                }
                onClick={() => resolveAsDifferent.mutate(alert.id)}
              >
                Marquer comme différentes (rejeter)
              </Button>

              <Button
                type="button"
                variant="secondary"
                className="text-xs"
                disabled={
                  mergeRecipes.isLoading ||
                  !newRecipe ||
                  !similarRecipe
                }
                onClick={() => {
                  if (!newRecipe || !similarRecipe) return;
                  mergeRecipes.mutate({
                    alertId: alert.id,
                    canonicalId: similarRecipe.id,
                    duplicateId: newRecipe.id
                  });
                }}
              >
                Fusionner (garder la recette existante)
              </Button>

              <Button
                type="button"
                variant="secondary"
                className="text-xs"
                disabled={
                  mergeRecipes.isLoading ||
                  !newRecipe ||
                  !similarRecipe
                }
                onClick={() => {
                  if (!newRecipe || !similarRecipe) return;
                  mergeRecipes.mutate({
                    alertId: alert.id,
                    canonicalId: newRecipe.id,
                    duplicateId: similarRecipe.id
                  });
                }}
              >
                Fusionner (garder la nouvelle)
              </Button>
            </div>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-50">
          Alertes de similarité de recettes
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Comparez les recettes détectées comme similaires, marquez les
          variantes parent/enfant ou rejetez les faux positifs.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {isLoading
            ? "Chargement des alertes…"
            : `${pendingCount} alerte(s) en attente ou en cours de revue.`}
        </p>
      </div>

      <div className="space-y-3">{renderAlerts()}</div>
    </div>
  );
};

export default AdminAlertsPage;