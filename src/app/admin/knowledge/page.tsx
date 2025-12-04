"use client";

import { useState } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient
} from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Button } from "@/components/ui/Button";

interface KnowledgeConcept {
  id: string;
  concept_key: string;
  title: string;
  category: string | null;
  work_status: string | null;
  difficulty_level: number | null;
  usage_priority: number | null;
}

const fetchKnowledge = async (): Promise<KnowledgeConcept[]> => {
  const { data, error } = await supabase
    .from("knowledge_base")
    .select(
      "id, concept_key, title, category, work_status, difficulty_level, usage_priority"
    )
    .order("usage_priority", { ascending: false })
    .order("title", { ascending: true });

  if (error) {
    throw error;
  }

  return (data as KnowledgeConcept[]) ?? [];
};

const statusLabel = (status?: string | null) => {
  if (!status) return "not_started";
  return status;
};

const workStatusOptions: { value: string; label: string }[] = [
  { value: "not_started", label: "non démarré" },
  { value: "researching", label: "en recherche" },
  { value: "draft", label: "brouillon" },
  { value: "ready", label: "prêt" },
  { value: "published", label: "publié" }
];

const difficultyOptions: { value: number; label: string }[] = [
  { value: 1, label: "1 - Basique" },
  { value: 2, label: "2 - Intermédiaire" },
  { value: 3, label: "3 - Avancé" }
];

const AdminKnowledgePage = () => {
  const queryClient = useQueryClient();
  const {
    data: concepts,
    isLoading,
    isError
  } = useQuery<KnowledgeConcept[]>({
    queryKey: ["knowledge-base"],
    queryFn: fetchKnowledge
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [conceptKey, setConceptKey] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [workStatus, setWorkStatus] = useState<string>("not_started");
  const [difficultyLevel, setDifficultyLevel] = useState<number | null>(1);
  const [usagePriority, setUsagePriority] = useState<number | null>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setConceptKey("");
    setTitle("");
    setCategory("");
    setWorkStatus("not_started");
    setDifficultyLevel(1);
    setUsagePriority(0);
    setErrorMessage(null);
    setInfoMessage(null);
  };

  const fillFormFromConcept = (concept: KnowledgeConcept) => {
    setEditingId(concept.id);
    setConceptKey(concept.concept_key);
    setTitle(concept.title);
    setCategory(concept.category ?? "");
    setWorkStatus(concept.work_status ?? "not_started");
    setDifficultyLevel(
      typeof concept.difficulty_level === "number"
        ? concept.difficulty_level
        : 1
    );
    setUsagePriority(
      typeof concept.usage_priority === "number"
        ? concept.usage_priority
        : 0
    );
    setErrorMessage(null);
    setInfoMessage(null);
  };

  const upsertMutation = useMutation({
    mutationFn: async () => {
      setErrorMessage(null);
      setInfoMessage(null);

      if (!conceptKey.trim() || !title.trim()) {
        throw new Error(
          "Le champ clé de concept et le titre sont obligatoires."
        );
      }

      const payload: Record<string, unknown> = {
        concept_key: conceptKey.trim(),
        title: title.trim(),
        category: category.trim() || null,
        work_status: workStatus || null,
        difficulty_level:
          typeof difficultyLevel === "number" ? difficultyLevel : null,
        usage_priority:
          typeof usagePriority === "number" ? usagePriority : null
      };

      if (editingId) {
        const { error } = await supabase
          .from("knowledge_base")
          .update(payload)
          .eq("id", editingId);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase
          .from("knowledge_base")
          .insert([payload]);

        if (error) {
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });
      setInfoMessage(
        editingId
          ? "Concept mis à jour avec succès."
          : "Concept créé avec succès."
      );
      setEditingId(null);
      setConceptKey("");
      setTitle("");
      setCategory("");
      setWorkStatus("not_started");
      setDifficultyLevel(1);
      setUsagePriority(0);
    },
    onError: (err: any) => {
      setErrorMessage(
        err?.message ??
          "Erreur lors de l'enregistrement du concept de connaissance."
      );
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("knowledge_base")
        .delete()
        .eq("id", id);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });
      setInfoMessage("Concept supprimé.");
      resetForm();
    },
    onError: (err: any) => {
      setErrorMessage(
        err?.message ?? "Erreur lors de la suppression du concept."
      );
    }
  });

  if (isError) {
    return (
      <p className="text-sm text-red-300">
        Impossible de charger la base de connaissances.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-50">
          Base de connaissances scientifique
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Concepts scientifiques utilisés pour expliquer les recettes (principe
          thermique, réactions de Maillard, émulsions…).
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Workflow : non démarré → en recherche → brouillon → prêt → publié.
        </p>
      </div>

      {/* Formulaire de création / édition */}
      <section className="card px-5 py-4 text-xs">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold text-slate-100">
              {editingId
                ? "Modifier un concept scientifique"
                : "Créer un nouveau concept scientifique"}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Renseignez la clé interne, le titre visible et les métadonnées
              (catégorie, statut, difficulté, priorité).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="text-[11px]"
              onClick={resetForm}
              disabled={upsertMutation.isLoading}
            >
              Réinitialiser le formulaire
            </Button>
          </div>
        </div>

        <form
          className="mt-4 grid gap-3 md:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!upsertMutation.isLoading) {
              upsertMutation.mutate();
            }
          }}
        >
          <div>
            <label htmlFor="concept_key" className="block text-[11px]">
              Clé de concept (unique)
            </label>
            <input
              id="concept_key"
              type="text"
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="ex: reaction_maillard"
              value={conceptKey}
              onChange={(e) => setConceptKey(e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="title" className="block text-[11px]">
              Titre
            </label>
            <input
              id="title"
              type="text"
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Réaction de Maillard"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="category" className="block text-[11px]">
              Catégorie
            </label>
            <input
              id="category"
              type="text"
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="thermodynamique, chimie, texture…"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="work_status" className="block text-[11px]">
              Statut
            </label>
            <select
              id="work_status"
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
              value={workStatus}
              onChange={(e) => setWorkStatus(e.target.value)}
            >
              {workStatusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="difficulty_level" className="block text-[11px]">
              Difficulté
            </label>
            <select
              id="difficulty_level"
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
              value={difficultyLevel ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                setDifficultyLevel(val ? Number(val) : null);
              }}
            >
              <option value="">—</option>
              {difficultyOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="usage_priority" className="block text-[11px]">
              Priorité d&apos;usage
            </label>
            <input
              id="usage_priority"
              type="number"
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
              value={usagePriority ?? 0}
              onChange={(e) => {
                const val = e.target.value;
                setUsagePriority(val === "" ? null : Number(val));
              }}
            />
            <p className="mt-1 text-[10px] text-slate-500">
              Plus la valeur est élevée, plus le concept est prioritaire dans
              l&apos;UI et le RAG.
            </p>
          </div>

          <div className="mt-4 flex items-center gap-2 md:col-span-4">
            <Button
              type="submit"
              variant="primary"
              disabled={upsertMutation.isLoading}
              className="inline-flex items-center gap-2 text-[11px]"
            >
              {upsertMutation.isLoading && (
                <LoadingSpinner size="sm" className="text-slate-100" />
              )}
              <span>{editingId ? "Mettre à jour le concept" : "Créer"}</span>
            </Button>

            {editingId && (
              <Button
                type="button"
                variant="secondary"
                className="inline-flex items-center gap-2 text-[11px] text-red-300 hover:text-red-200"
                disabled={deleteMutation.isLoading}
                onClick={() => {
                  // eslint-disable-next-line no-alert
                  const ok = window.confirm(
                    "Supprimer ce concept ? Cette action est irréversible."
                  );
                  if (ok) {
                    deleteMutation.mutate(editingId);
                  }
                }}
              >
                Supprimer
              </Button>
            )}

            <div className="ml-auto flex flex-col items-end gap-1 text-[11px]">
              {infoMessage && (
                <p className="text-emerald-300">{infoMessage}</p>
              )}
              {errorMessage && <p className="text-red-300">{errorMessage}</p>}
            </div>
          </div>
        </form>
      </section>

      {/* Liste des concepts */}
      <div className="card overflow-hidden">
        <div className="border-b border-slate-800 px-4 py-3 text-xs text-slate-400">
          {isLoading
            ? "Chargement des concepts…"
            : `${concepts?.length ?? 0} concept(s) dans la base.`}
        </div>

        <div className="max-h-[560px] overflow-auto text-sm">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-2 text-left">Concept</th>
                <th className="px-4 py-2 text-left">Catégorie</th>
                <th className="px-4 py-2 text-left">Difficulté</th>
                <th className="px-4 py-2 text-left">Statut</th>
                <th className="px-4 py-2 text-right">Priorité</th>
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
              ) : !concepts || concepts.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    Aucun concept pour le moment.
                  </td>
                </tr>
              ) : (
                concepts.map((concept) => (
                  <tr key={concept.id}>
                    <td className="px-4 py-2 align-top">
                      <div className="font-medium text-slate-100">
                        {concept.title}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {concept.concept_key}
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-slate-400">
                      {concept.category || "—"}
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-slate-400">
                      {concept.difficulty_level ?? "—"}
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-slate-400">
                      {statusLabel(concept.work_status)}
                    </td>
                    <td className="px-4 py-2 align-top text-right text-xs text-slate-400">
                      {concept.usage_priority ?? 0}
                    </td>
                    <td className="px-4 py-2 align-top text-right text-xs">
                      <Button
                        type="button"
                        variant="secondary"
                        className="text-[11px]"
                        onClick={() => fillFormFromConcept(concept)}
                      >
                        Éditer
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

export default AdminKnowledgePage;