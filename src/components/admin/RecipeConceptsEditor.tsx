"use client";

import React, { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface KnowledgeConcept {
  id: string;
  concept_key: string;
  title: string;
  category: string | null;
  work_status: string | null;
}

interface RecipeConceptLink {
  id: string;
  concept_key: string;
}

interface RecipeConceptsEditorProps {
  recipeId: string;
}

const fetchAllConcepts = async (): Promise<KnowledgeConcept[]> => {
  const { data, error } = await supabase
    .from("knowledge_base")
    .select("id, concept_key, title, category, work_status")
    .order("usage_priority", { ascending: false })
    .order("title", { ascending: true });

  if (error) {
    throw error;
  }

  return (data as KnowledgeConcept[]) ?? [];
};

const fetchRecipeConcepts = async (
  recipeId: string
): Promise<RecipeConceptLink[]> => {
  const { data, error } = await supabase
    .from("recipe_concepts")
    .select("id, concept_key")
    .eq("recipe_id", recipeId);

  if (error) {
    throw error;
  }

  return (data as RecipeConceptLink[]) ?? [];
};

export const RecipeConceptsEditor: React.FC<RecipeConceptsEditorProps> = ({
  recipeId
}) => {
  const queryClient = useQueryClient();
  const { data: allConcepts, isLoading: isLoadingConcepts } = useQuery<
    KnowledgeConcept[]
  >({
    queryKey: ["knowledge-base-all"],
    queryFn: fetchAllConcepts
  });

  const {
    data: links,
    isLoading: isLoadingLinks,
    isError
  } = useQuery<RecipeConceptLink[]>({
    queryKey: ["recipe-concepts-list", recipeId],
    queryFn: () => fetchRecipeConcepts(recipeId)
  });

  const [search, setSearch] = useState("");
  const addMutation = useMutation({
    mutationFn: async (conceptKey: string) => {
      const { error } = await supabase.from("recipe_concepts").insert([
        {
          recipe_id: recipeId,
          concept_key: conceptKey
        }
      ]);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["recipe-concepts-list", recipeId]
      });
    }
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("recipe_concepts")
        .delete()
        .eq("id", id);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["recipe-concepts-list", recipeId]
      });
    }
  });

  const linkedKeys = useMemo(
    () => new Set((links ?? []).map((l) => l.concept_key)),
    [links]
  );

  const linkedConcepts = useMemo(() => {
    if (!allConcepts || !links) return [];
    const byKey = new Map<string, KnowledgeConcept>();
    allConcepts.forEach((c) => {
      byKey.set(c.concept_key, c);
    });
    return links
      .map((link) => ({
        link,
        concept: byKey.get(link.concept_key) ?? null
      }))
      .filter((item) => item.concept !== null) as {
      link: RecipeConceptLink;
      concept: KnowledgeConcept;
    }[];
  }, [links, allConcepts]);

  const filteredSuggestions = useMemo(() => {
    if (!allConcepts) return [];
    const needle = search.trim().toLowerCase();
    return allConcepts
      .filter((concept) => {
        if (linkedKeys.has(concept.concept_key)) return false;
        if (!needle) return true;
        const haystack = `${concept.title} ${concept.concept_key} ${
          concept.category ?? ""
        } ${concept.work_status ?? ""}`.toLowerCase();
        return haystack.includes(needle);
      })
      .slice(0, 12);
  }, [allConcepts, linkedKeys, search]);

  if (isError) {
    return (
      <p className="text-xs text-red-300">
        Impossible de charger les concepts liés à cette recette.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          Concepts scientifiques liés
        </h3>
      </div>

      <p className="text-[11px] text-slate-500">
        Les concepts de la base{" "}
        <code className="rounded bg-slate-800/80 px-1">knowledge_base</code> sont
        associés à cette recette via{" "}
        <code className="rounded bg-slate-800/80 px-1">recipe_concepts</code>.
        Cela enrichit le contexte pour ton futur RAG.
      </p>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-slate-200">
          Concepts actuellement liés
        </p>
        {isLoadingLinks || isLoadingConcepts ? (
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <LoadingSpinner size="sm" />
            <span>Chargement des concepts liés…</span>
          </div>
        ) : linkedConcepts.length === 0 ? (
          <p className="text-[11px] text-slate-500">
            Aucun concept scientifique n&apos;est encore associé à cette
            recette.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {linkedConcepts.map(({ link, concept }) => (
              <span
                key={link.id}
                className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-100"
              >
                <span>{concept.title}</span>
                <span className="text-[10px] text-slate-400">
                  ({concept.concept_key})
                </span>
                <button
                  type="button"
                  className="ml-1 text-[10px] text-red-300 hover:text-red-200"
                  onClick={() => removeMutation.mutate(link.id)}
                  disabled={removeMutation.isLoading}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 space-y-2">
        <p className="text-[11px] font-semibold text-slate-200">
          Ajouter un concept
        </p>
        <input
          type="text"
          placeholder="Rechercher par titre, clé, catégorie…"
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search.trim() && filteredSuggestions.length === 0 && (
          <p className="mt-1 text-[11px] text-slate-500">
            Aucun concept ne correspond à cette recherche.
          </p>
        )}
        {filteredSuggestions.length > 0 && (
          <div className="mt-2 max-h-52 space-y-1 overflow-auto rounded-md border border-slate-800 bg-slate-950/60 p-2 text-[11px]">
            {filteredSuggestions.map((concept) => (
              <div
                key={concept.id}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-slate-900/80"
              >
                <div>
                  <div className="font-medium text-slate-100">
                    {concept.title}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {concept.concept_key}
                    {concept.category && ` · ${concept.category}`}
                    {concept.work_status && ` · ${concept.work_status}`}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="text-[11px]"
                  disabled={addMutation.isLoading}
                  onClick={() => addMutation.mutate(concept.concept_key)}
                >
                  Ajouter
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};