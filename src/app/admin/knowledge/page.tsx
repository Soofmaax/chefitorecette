"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

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
    .order("usage_priority", { ascending: false });

  if (error) {
    throw error;
  }

  return (data as KnowledgeConcept[]) ?? [];
};

const statusLabel = (status?: string | null) => {
  if (!status) return "not_started";
  return status;
};

const AdminKnowledgePage = () => {
  const {
    data: concepts,
    isLoading,
    isError
  } = useQuery<KnowledgeConcept[]>({
    queryKey: ["knowledge-base"],
    queryFn: fetchKnowledge
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-slate-400"
                  >
                    <LoadingSpinner className="mr-2 inline-block" />
                    Chargement…
                  </td>
                </tr>
              ) : !concepts || concepts.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
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