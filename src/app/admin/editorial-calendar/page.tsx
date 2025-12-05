"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

type EditorialStatus = "planned" | "draft" | "enriching" | "published";

interface EditorialCalendarRow {
  id: string;
  title: string;
  category: string | null;
  difficulty: string | null;
  target_month: string; // ISO date string (YYYY-MM-DD)
  status: EditorialStatus;
  priority: number | null;
  tags: string[] | null;
  chefito_angle: string | null;
  recipe_id: string | null;
}

const fetchEditorialCalendar = async (): Promise<EditorialCalendarRow[]> => {
  const { data, error } = await supabase
    .from("editorial_calendar")
    .select(
      "id, title, category, difficulty, target_month, status, priority, tags, chefito_angle, recipe_id"
    )
    .order("target_month", { ascending: true })
    .order("priority", { ascending: false })
    .limit(250);

  if (error) {
    throw error;
  }

  return (data as EditorialCalendarRow[]) ?? [];
};

const formatMonth = (isoDate: string) => {
  if (!isoDate) return "—";
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
};

const difficultyLabel = (value: string | null) => {
  if (!value) return "—";
  if (value === "beginner") return "Débutant";
  if (value === "intermediate") return "Intermédiaire";
  if (value === "advanced") return "Avancé";
  return value;
};

const statusLabel: Record<EditorialStatus, string> = {
  planned: "Planned",
  draft: "Draft",
  enriching: "Enriching",
  published: "Published"
};

const statusOrder: EditorialStatus[] = [
  "planned",
  "draft",
  "enriching",
  "published"
];

const AdminEditorialCalendarPage = () => {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const importSuccess = searchParams?.get("import") === "success";

  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | EditorialStatus>(
    "all"
  );
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setCategoryFilter("all");
    setDifficultyFilter("all");
    setMonthFilter("all");
    setPriorityFilter("all");
  };

  const {
    data: rows,
    isLoading,
    isError
  } = useQuery<EditorialCalendarRow[]>({
    queryKey: ["editorial-calendar"],
    queryFn: fetchEditorialCalendar
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (params: { id: string; status: EditorialStatus }) => {
      const { id, status } = params;
      const { error } = await supabase
        .from("editorial_calendar")
        .update({ status })
        .eq("id", id);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["editorial-calendar"] });
    }
  });

  const updatePriorityMutation = useMutation({
    mutationFn: async (params: { id: string; priority: number }) => {
      const { id, priority } = params;
      const { error } = await supabase
        .from("editorial_calendar")
        .update({ priority })
        .eq("id", id);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["editorial-calendar"] });
    }
  });

  const items = useMemo(
    () => rows ?? [],
    [rows]
  );

  const uniqueCategories = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((r) => r.category)
            .filter((v): v is string => !!v && v.trim() !== "")
        )
      ).sort(),
    [items]
  );

  const uniqueMonths = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((r) => r.target_month)
            .filter((v) => !!v && v.trim() !== "")
        )
      ).sort(),
    [items]
  );

  const uniquePriorities = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((r) => r.priority ?? 0)
            .filter((v) => typeof v === "number")
        )
      ).sort((a, b) => a - b),
    [items]
  );

  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }
      if (
        categoryFilter !== "all" &&
        (item.category || "").toLowerCase() !== categoryFilter.toLowerCase()
      ) {
        return false;
      }
      if (
        difficultyFilter !== "all" &&
        (item.difficulty || "") !== difficultyFilter
      ) {
        return false;
      }
      if (monthFilter !== "all" && item.target_month !== monthFilter) {
        return false;
      }
      if (
        priorityFilter !== "all" &&
        String(item.priority ?? "") !== priorityFilter
      ) {
        return false;
      }

      if (!needle) return true;

      const haystack = `${item.title} ${item.category ?? ""} ${
        item.chefito_angle ?? ""
      } ${(item.tags ?? []).join(" ")}`.toLowerCase();

      return haystack.includes(needle);
    });
  }, [
    items,
    search,
    statusFilter,
    categoryFilter,
    difficultyFilter,
    monthFilter,
    priorityFilter
  ]);

  const total = items.length;
  const publishedCount = items.filter((i) => i.status === "published").length;
  const publishedRatio = total > 0 ? Math.round((publishedCount / total) * 100) : 0;

  const renderActions = (row: EditorialCalendarRow) => {
    if (row.recipe_id) {
      return (
        <div className="flex flex-col items-end gap-1 text-xs">
          <Link href={`/admin/recipes/${row.recipe_id}/edit`}>
            <Button variant="secondary" className="text-xs">
              Voir la recette
            </Button>
          </Link>
          <span className="text-[11px] text-slate-500">Liée à une recette</span>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-end gap-1 text-xs">
        <Link
          href={`/admin/recipes/create?editorialId=${row.id}`}
          className="inline-flex"
        >
          <Button variant="primary" className="text-xs">
            Créer la recette
          </Button>
        </Link>
        <span className="text-[11px] text-slate-500">
          Aucune recette liée pour le moment
        </span>
      </div>
    );
  };

  const renderTableView = () => {
    if (isLoading) {
      return (
        <div className="card">
          <div className="flex items-center justify-center py-8 text-sm text-slate-400">
            <LoadingSpinner className="mr-2" />
            Chargement du calendrier éditorial…
          </div>
        </div>
      );
    }

    if (isError) {
      return (
        <p className="text-sm text-red-300">
          Impossible de charger le calendrier éditorial.
        </p>
      );
    }

    if (filteredItems.length === 0) {
      return (
        <div className="card px-4 py-4 text-sm text-slate-400">
          Aucune entrée éditoriale pour ces filtres.
        </div>
      );
    }

    return (
      <div className="card overflow-hidden">
        <div className="border-b border-slate-800 px-4 py-3 text-xs text-slate-400">
          {filteredItems.length} entrée(s) affichée(s) (limitées aux 250
          premières).
        </div>
        <div className="max-h-[560px] overflow-auto text-sm">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-2 text-left">Titre</th>
                <th className="px-4 py-2 text-left">Mois cible</th>
                <th className="px-4 py-2 text-left">Statut</th>
                <th className="px-4 py-2 text-left">Catégorie</th>
                <th className="px-4 py-2 text-left">Difficulté</th>
                <th className="px-4 py-2 text-left">Priorité</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40">
              {filteredItems.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-2 align-top">
                    <div className="font-medium text-slate-100">
                      {row.title}
                    </div>
                    {row.chefito_angle && (
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {row.chefito_angle}
                      </div>
                    )}
                    {row.tags && row.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-slate-400">
                        {row.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded bg-slate-800 px-1.5 py-0.5"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 align-top text-xs text-slate-400">
                    {formatMonth(row.target_month)}
                  </td>
                  <td className="px-4 py-2 align-top text-xs text-slate-400">
                    <select
                      className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      value={row.status}
                      onChange={(e) =>
                        updateStatusMutation.mutate({
                          id: row.id,
                          status: e.target.value as EditorialStatus
                        })
                      }
                    >
                      <option value="planned">Planned</option>
                      <option value="draft">Draft</option>
                      <option value="enriching">Enriching</option>
                      <option value="published">Published</option>
                    </select>
                  </td>
                  <td className="px-4 py-2 align-top text-xs text-slate-400">
                    {row.category || "—"}
                  </td>
                  <td className="px-4 py-2 align-top text-xs text-slate-400">
                    {difficultyLabel(row.difficulty)}
                  </td>
                  <td className="px-4 py-2 align-top text-xs text-slate-400">
                    <select
                      className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      value={String(row.priority ?? "")}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (Number.isNaN(val)) return;
                        updatePriorityMutation.mutate({
                          id: row.id,
                          priority: val
                        });
                      }}
                    >
                      <option value="">—</option>
                      {uniquePriorities.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2 align-top text-right">
                    {renderActions(row)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderKanbanView = () => {
    if (isLoading) {
      return (
        <div className="card">
          <div className="flex items-center justify-center py-8 text-sm text-slate-400">
            <LoadingSpinner className="mr-2" />
            Chargement du calendrier éditorial…
          </div>
        </div>
      );
    }

    if (isError) {
      return (
        <p className="text-sm text-red-300">
          Impossible de charger le calendrier éditorial.
        </p>
      );
    }

    const byStatus: Record<EditorialStatus, EditorialCalendarRow[]> = {
      planned: [],
      draft: [],
      enriching: [],
      published: []
    };

    filteredItems.forEach((item) => {
      byStatus[item.status].push(item);
    });

    return (
      <div className="grid gap-4 md:grid-cols-4">
        {statusOrder.map((status) => (
          <div key={status} className="card flex flex-col px-3 py-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                {statusLabel[status]}
              </h3>
              <span className="text-[11px] text-slate-500">
                {byStatus[status].length}
              </span>
            </div>
            <div className="flex-1 space-y-2 overflow-auto">
              {byStatus[status].length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  Aucun élément dans cette colonne.
                </p>
              ) : (
                byStatus[status].map((row) => (
                  <div
                    key={row.id}
                    className="rounded-md border border-slate-800 bg-slate-950/70 p-2 text-[11px]"
                  >
                    <div className="mb-1 font-medium text-slate-100">
                      {row.title}
                    </div>
                    <div className="mb-1 text-[10px] text-slate-500">
                      {formatMonth(row.target_month)}
                      {row.category && ` • ${row.category}`}
                      {row.difficulty && ` • ${difficultyLabel(row.difficulty)}`}
                    </div>
                    {row.tags && row.tags.length > 0 && (
                      <div className="mb-1 flex flex-wrap gap-1">
                        {row.tags.slice(0, 4).map((tag) => (
                          <span
                            key={tag}
                            className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300"
                          >
                            {tag}
                          </span>
                        ))}
                        {row.tags.length > 4 && (
                          <span className="text-[10px] text-slate-500">
                            +{row.tags.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500">
                        Priorité {row.priority ?? "—"}
                      </span>
                      <div className="flex items-center gap-1">
                        {row.recipe_id ? (
                          <Link
                            href={`/admin/recipes/${row.recipe_id}/edit`}
                            className="text-[10px] text-primary-300 hover:text-primary-200"
                          >
                            Voir recette
                          </Link>
                        ) : (
                          <Link
                            href={`/admin/recipes/create?editorialId=${row.id}`}
                            className="text-[10px] text-primary-300 hover:text-primary-200"
                          >
                            Créer recette
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {importSuccess && (
        <div className="rounded-md border border-emerald-500/60 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-100">
          Import CSV éditorial terminé. Les entrées importées apparaissent dans la liste ci-dessous.
        </div>
      )}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">
            Calendrier éditorial
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Planifie les 250 recettes Gemini dans un calendrier éditorial
            piloté par statut et priorité.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {total > 0
              ? `${publishedCount}/${total} publiées • ${publishedRatio}% du plan`
              : "Aucune entrée éditoriale pour le moment."}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 md:flex-row">
          <div className="flex rounded-md border border-slate-800 bg-slate-900/60 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 ${
                viewMode === "table"
                  ? "bg-primary-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              Vue tableau
            </button>
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={`px-3 py-1.5 ${
                viewMode === "kanban"
                  ? "bg-primary-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              Vue Kanban
            </button>
          </div>

          <Link href="/admin/editorial-calendar/import">
            <Button variant="secondary" className="text-xs">
              Import CSV éditorial
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center">
          <input
            type="text"
            placeholder="Recherche par titre, catégorie, angle…"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 md:w-80"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            onClick={resetFilters}
            className="mt-1 inline-flex items-center rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-100 hover:bg-slate-800 md:mt-0"
          >
            Réinitialiser les filtres
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "all" | EditorialStatus)
            }
          >
            <option value="all">Tous statuts</option>
            <option value="planned">Planned</option>
            <option value="draft">Draft</option>
            <option value="enriching">Enriching</option>
            <option value="published">Published</option>
          </select>

          <select
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">Toutes catégories</option>
            {uniqueCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
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
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
          >
            <option value="all">Tous mois</option>
            {uniqueMonths.map((m) => (
              <option key={m} value={m}>
                {formatMonth(m)}
              </option>
            ))}
          </select>

          <select
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="all">Toutes priorités</option>
            {uniquePriorities.map((p) => (
              <option key={p} value={String(p)}>
                Priorité {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {viewMode === "table" ? renderTableView() : renderKanbanView()}
    </div>
  );
};

export default AdminEditorialCalendarPage;