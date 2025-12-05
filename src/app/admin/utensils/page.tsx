"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface Utensil {
  key: string;
  label: string;
}

interface UtensilWithUsage extends Utensil {
  usage_count: number;
}

const fetchUtensils = async (): Promise<UtensilWithUsage[]> => {
  const { data, error } = await supabase
    .from("utensils_catalog")
    .select("key, label");

  if (error) {
    throw error;
  }

  const base = ((data as Utensil[]) ?? []).reduce<
    Record<string, UtensilWithUsage>
  >((acc, u) => {
    acc[u.key] = { ...u, usage_count: 0 };
    return acc;
  }, {});

  if (Object.keys(base).length === 0) {
    return [];
  }

  const { data: usageData, error: usageError } = await supabase
    .from("recipe_utensils")
    .select("utensil_key");

  if (usageError) {
    throw usageError;
  }

  (usageData as { utensil_key: string }[] | null)?.forEach((row) => {
    if (base[row.utensil_key]) {
      base[row.utensil_key].usage_count += 1;
    }
  });

  return Object.values(base).sort((a, b) =>
    a.label.localeCompare(b.label, "fr")
  );
};

const AdminUtensilsPage = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<UtensilWithUsage | null>(null);
  const [form, setForm] = useState<Utensil>({ key: "", label: "" });

  const {
    data: utensils,
    isLoading,
    isError
  } = useQuery<UtensilWithUsage[]>({
    queryKey: ["utensils-catalog"],
    queryFn: fetchUtensils
  });

  const upsertMutation = useMutation({
    mutationFn: async (payload: Utensil) => {
      const base = {
        key: payload.key.trim(),
        label: payload.label.trim()
      };

      if (!base.key || !base.label) {
        throw new Error("Clé et label sont requis.");
      }

      if (editing) {
        const { error } = await supabase
          .from("utensils_catalog")
          .update(base)
          .eq("key", editing.key);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase
          .from("utensils_catalog")
          .insert([base]);

        if (error) {
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["utensils-catalog"] });
      setEditing(null);
      setForm({ key: "", label: "" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (key: string) => {
      // vérif usage
      const { data, error } = await supabase
        .from("recipe_utensils")
        .select("recipe_id", { count: "exact", head: true })
        .eq("utensil_key", key);

      if (error) {
        throw error;
      }

      const usedCount = (data as any)?.length ?? 0;
      if (usedCount > 0) {
        throw new Error(
          "Impossible de supprimer : cet ustensile est utilisé par au moins une recette."
        );
      }

      const { error: delError } = await supabase
        .from("utensils_catalog")
        .delete()
        .eq("key", key);

      if (delError) {
        throw delError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["utensils-catalog"] });
    }
  });

  const startCreate = () => {
    setEditing(null);
    setForm({ key: "", label: "" });
  };

  const startEdit = (u: UtensilWithUsage) => {
    setEditing(u);
    setForm({ key: u.key, label: u.label });
  };

  const handleChange = (field: keyof Utensil, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    await upsertMutation.mutateAsync(form);
  };

  if (isError) {
    return (
      <p className="text-sm text-red-300">
        Impossible de charger le catalogue des ustensiles.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">
            Ustensiles / matériel
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Gère le catalogue d&apos;ustensiles structurés utilisé pour annoter
            les recettes (four, airfryer, Thermomix, Cookeo, etc.). Ces clefs
            sont utilisées dans la table{" "}
            <code className="rounded bg-slate-800 px-1 text-[11px]">
              recipe_utensils
            </code>
            .
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            className="text-xs"
            onClick={() => router.push("/admin/utensils/import")}
          >
            Import CSV
          </Button>
          <Button type="button" variant="primary" onClick={startCreate}>
            Nouvel ustensile
          </Button>
        </div>
      </div>

      {(editing || form.key || form.label) && (
        <div className="card space-y-4 px-4 py-4">
          <h2 className="text-sm font-semibold text-slate-100">
            {editing ? "Modifier l’ustensile" : "Nouvel ustensile"}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="utensil_key">Clé (identifiant stable)</label>
              <input
                id="utensil_key"
                type="text"
                className="mt-1 w-full"
                placeholder="four, airfryer, thermomix…"
                value={form.key}
                onChange={(e) => handleChange("key", e.target.value)}
                disabled={!!editing}
              />
              <p className="mt-1 text-xs text-slate-500">
                Identifiant interne stable utilisé dans{" "}
                <code className="rounded bg-slate-800 px-1 text-[11px]">
                  recipe_utensils
                </code>
                . Non modifiable après création.
              </p>
            </div>
            <div>
              <label htmlFor="utensil_label">Label affiché</label>
              <input
                id="utensil_label"
                type="text"
                className="mt-1 w-full"
                placeholder="Four traditionnel, Airfryer, Thermomix…"
                value={form.label}
                onChange={(e) => handleChange("label", e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="primary"
                onClick={handleSubmit}
                disabled={upsertMutation.isPending}
                className="inline-flex items-center gap-2"
              >
                {upsertMutation.isPending && (
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
                  setForm({ key: "", label: "" });
                }}
              >
                Annuler
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="border-b border-slate-800 px-4 py-3 text-xs text-slate-400">
          {isLoading
            ? "Chargement des ustensiles…"
            : `${utensils?.length ?? 0} ustensile(s) dans le catalogue.`}
        </div>

        <div className="max-h-[560px] overflow-auto text-sm">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-2 text-left">Clé</th>
                <th className="px-4 py-2 text-left">Label</th>
                <th className="px-4 py-2 text-right">Usage recettes</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-slate-400"
                  >
                    <LoadingSpinner className="mr-2 inline-block" />
                    Chargement…
                  </td>
                </tr>
              ) : !utensils || utensils.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    Aucun ustensile dans le catalogue.
                  </td>
                </tr>
              ) : (
                utensils.map((u) => (
                  <tr key={u.key}>
                    <td className="px-4 py-2 align-top text-xs text-slate-400">
                      <code className="rounded bg-slate-900 px-1 py-0.5 text-[11px]">
                        {u.key}
                      </code>
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-slate-200">
                      {u.label}
                    </td>
                    <td className="px-4 py-2 align-top text-right text-xs text-slate-400">
                      {u.usage_count}
                    </td>
                    <td className="px-4 py-2 align-top text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="text-xs"
                          onClick={() => startEdit(u)}
                        >
                          Éditer
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="text-xs text-red-300 hover:text-red-200"
                          disabled={deleteMutation.isPending || u.usage_count > 0}
                          onClick={() => {
                            // eslint-disable-next-line no-alert
                            const ok = window.confirm(
                              `Supprimer l'ustensile \"${u.label}\" ?`
                            );
                            if (!ok) return;
                            deleteMutation.mutate(u.key);
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

export default AdminUtensilsPage;