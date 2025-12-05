"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useToast } from "@/components/ui/ToastProvider";

type CsvRow = Record<string, string>;

interface ParsedRow {
  index: number;
  values: CsvRow;
}

type EditorialStatus = "planned" | "draft" | "enriching" | "published";

interface EditorialImportRow {
  index: number;
  title: string;
  category: string | null;
  difficulty: string | null;
  targetMonth: string; // YYYY-MM-01
  status: EditorialStatus;
  priority: number;
  tags: string[];
  chefitoAngle: string | null;
  errors: string[];
}

interface ColumnMapping {
  title: string | null;
  category: string | null;
  difficulty: string | null;
  target_month: string | null;
  status: string | null;
  priority: string | null;
  tags: string | null;
  chefito_angle: string | null;
}

const normalizeHeader = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const guessColumnMapping = (headers: string[]): ColumnMapping => {
  const find = (candidates: string[]): string | null => {
    const normalizedHeaders = headers.map((h) => normalizeHeader(h));
    for (const candidate of candidates) {
      const needle = normalizeHeader(candidate);
      const idx = normalizedHeaders.findIndex((h) => h.includes(needle));
      if (idx !== -1) {
        return headers[idx];
      }
    }
    return null;
  };

  return {
    title: find(["title", "titre", "recipe_title"]),
    category: find(["category", "categorie", "catégorie"]),
    difficulty: find(["difficulty", "difficulte", "difficulté"]),
    target_month: find(["target_month", "mois", "month", "mois_cible"]),
    status: find(["status", "statut"]),
    priority: find(["priority", "priorite", "priorité", "prio"]),
    tags: find(["tags", "mots_cles", "mots-clés", "keywords"]),
    chefito_angle: find(["chefito_angle", "angle", "angle_chefito"])
  };
};

const parseCsv = (text: string): { headers: string[]; rows: ParsedRow[] } => {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    throw new Error("Le fichier CSV est vide.");
  }

  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semiCount > commaCount ? ";" : ",";

  const headers = firstLine.split(delimiter).map((h) => h.trim());
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const raw = lines[i];
    if (!raw) continue;
    const parts = raw.split(delimiter);
    const row: CsvRow = {};
    headers.forEach((h, idx) => {
      row[h] = (parts[idx] ?? "").trim();
    });
    rows.push({ index: i, values: row });
  }

  return { headers, rows };
};

const mapDifficulty = (value: string): string | null => {
  const v = value.toLowerCase();
  if (!v) return null;
  if (["beginner", "débutant", "debutant"].includes(v)) return "beginner";
  if (["intermediate", "intermédiaire", "intermediaire"].includes(v)) {
    return "intermediate";
  }
  if (["advanced", "avancé", "avance"].includes(v)) return "advanced";
  return null;
};

const mapStatus = (value: string): EditorialStatus => {
  const v = value.toLowerCase();
  if (["draft", "brouillon"].includes(v)) return "draft";
  if (["enriching", "enrichissement"].includes(v)) return "enriching";
  if (["published", "publié", "publie"].includes(v)) return "published";
  return "planned";
};

const parseTargetMonth = (value: string): string | null => {
  const v = value.trim();
  if (!v) return null;

  // Formats courants : YYYY-MM, YYYY/MM, YYYY-MM-DD, DD/MM/YYYY
  const isoLike = v.match(/^(\d{4})[-/](\d{2})(?:[-/](\d{2}))?$/);
  if (isoLike) {
    const year = isoLike[1];
    const month = isoLike[2];
    return `${year}-${month}-01`;
  }

  const frLike = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (frLike) {
    const year = frLike[3];
    const month = frLike[2];
    return `${year}-${month}-01`;
  }

  return null;
};

const buildImportRows = (
  parsed: ParsedRow[],
  mapping: ColumnMapping
): EditorialImportRow[] => {
  return parsed.map((row) => {
    const get = (columnName: string | null): string => {
      if (!columnName) return "";
      return row.values[columnName] ?? "";
    };

    const titleRaw = get(mapping.title);
    const categoryRaw = get(mapping.category);
    const difficultyRaw = get(mapping.difficulty);
    const targetMonthRaw = get(mapping.target_month);
    const statusRaw = get(mapping.status);
    const priorityRaw = get(mapping.priority);
    const tagsRaw = get(mapping.tags);
    const angleRaw = get(mapping.chefito_angle);

    const errors: string[] = [];

    const title = titleRaw.trim();
    if (!title) {
      errors.push("Titre manquant");
    }

    const targetMonth = parseTargetMonth(targetMonthRaw);
    if (!targetMonth) {
      errors.push("Mois cible invalide ou manquant");
    }

    const diff = difficultyRaw ? mapDifficulty(difficultyRaw) : null;
    if (difficultyRaw && !diff) {
      errors.push("Difficulté invalide");
    }

    const status = mapStatus(statusRaw);

    let priority = 1;
    if (priorityRaw) {
      const n = Number(priorityRaw);
      if (Number.isNaN(n) || n <= 0) {
        errors.push("Priorité invalide");
      } else {
        priority = n;
      }
    }

    const tags =
      tagsRaw
        ?.split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0) ?? [];

    const chefitoAngle = angleRaw.trim() || null;

    return {
      index: row.index,
      title,
      category: categoryRaw.trim() || null,
      difficulty: diff,
      targetMonth: targetMonth ?? "",
      status,
      priority,
      tags,
      chefitoAngle,
      errors
    };
  });
};

const AdminEditorialImportPage = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const importMutation = useMutation({
    mutationFn: async (rows: EditorialImportRow[]) => {
      const payload = rows
        .filter((r) => r.errors.length === 0)
        .map((r) => ({
          title: r.title,
          category: r.category,
          difficulty: r.difficulty,
          target_month: r.targetMonth,
          status: r.status,
          priority: r.priority,
          tags: r.tags,
          chefito_angle: r.chefitoAngle,
          recipe_id: null
        }));

      if (payload.length === 0) {
        throw new Error(
          "Aucune ligne valide à importer. Corrigez les erreurs du CSV."
        );
      }

      const { error } = await supabase
        .from("editorial_calendar")
        .insert(payload);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["editorial-calendar"] });
      showToast({
        type: "success",
        message: "Import CSV éditorial terminé avec succès."
      });
    },
    onError: (err: any) => {
      const msg =
        err?.message ?? "Erreur lors de l'import CSV éditorial.";
      showToast({
        type: "error",
        message: msg
      });
    }
  });

  const importRows = useMemo(() => {
    if (!mapping) return [];
    if (parsedRows.length === 0) return [];
    return buildImportRows(parsedRows, mapping);
  }, [parsedRows, mapping]);

  const validRows = useMemo(
    () => importRows.filter((r) => r.errors.length === 0),
    [importRows]
  );
  const invalidRows = useMemo(
    () => importRows.filter((r) => r.errors.length > 0),
    [importRows]
  );

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setFileName(null);
      setHeaders([]);
      setParsedRows([]);
      setMapping(null);
      setParseError(null);
      return;
    }

    setFileName(file.name);
    setParseError(null);
    setHeaders([]);
    setParsedRows([]);
    setMapping(null);

    try {
      const text = await file.text();
      const { headers: h, rows } = parseCsv(text);
      setHeaders(h);
      setParsedRows(rows);
      setMapping(guessColumnMapping(h));
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error(err);
      setParseError(
        err?.message ?? "Erreur lors de la lecture du fichier CSV."
      );
    }
  };

  const handleMappingChange = (field: keyof ColumnMapping, column: string) => {
    setMapping((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [field]: column || null
      };
    });
  };

  const handleImport = async () => {
    if (importRows.length === 0 || validRows.length === 0) return;
    try {
      await importMutation.mutateAsync(importRows);
    } catch (err) {
      // handled by mutation
    }
  };

  const previewRows = importRows.slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">
            Import CSV – Calendrier éditorial
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Importe jusqu&apos;à 250 lignes issues d&apos;un export Gemini ou
            d&apos;un tableur éditorial (titre, catégorie, difficulté, mois
            cible, statut, priorité, tags, angle Chefito).
          </p>
        </div>
      </div>

      <div className="card space-y-4 px-4 py-4">
        <div className="space-y-2">
          <label
            htmlFor="csv_file"
            className="text-xs font-semibold text-slate-200"
          >
            Fichier CSV
          </label>
          <input
            id="csv_file"
            type="file"
            accept=".csv,text/csv"
            className="w-full text-sm text-slate-200 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-100 hover:file:bg-slate-700"
            onChange={handleFileChange}
          />
          {fileName && (
            <p className="text-xs text-slate-500">Fichier sélectionné : {fileName}</p>
          )}
          {parseError && (
            <p className="text-xs text-red-300">{parseError}</p>
          )}
        </div>

        {headers.length > 0 && mapping && (
          <div className="space-y-3 text-xs">
            <p className="font-semibold text-slate-200">
              1. Mapping automatique des colonnes
            </p>
            <p className="text-[11px] text-slate-500">
              Vérifie que chaque champ éditorial est correctement associé à une
              colonne du CSV. Tu peux modifier le mapping si besoin.
            </p>

            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="mb-1 text-[11px] text-slate-400">Titre</p>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  value={mapping.title ?? ""}
                  onChange={(e) =>
                    handleMappingChange("title", e.target.value)
                  }
                >
                  <option value="">—</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-1 text-[11px] text-slate-400">Catégorie</p>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  value={mapping.category ?? ""}
                  onChange={(e) =>
                    handleMappingChange("category", e.target.value)
                  }
                >
                  <option value="">—</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-1 text-[11px] text-slate-400">Difficulté</p>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  value={mapping.difficulty ?? ""}
                  onChange={(e) =>
                    handleMappingChange("difficulty", e.target.value)
                  }
                >
                  <option value="">—</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-1 text-[11px] text-slate-400">Mois cible</p>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  value={mapping.target_month ?? ""}
                  onChange={(e) =>
                    handleMappingChange("target_month", e.target.value)
                  }
                >
                  <option value="">—</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-1 text-[11px] text-slate-400">Statut</p>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  value={mapping.status ?? ""}
                  onChange={(e) =>
                    handleMappingChange("status", e.target.value)
                  }
                >
                  <option value="">—</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-1 text-[11px] text-slate-400">Priorité</p>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  value={mapping.priority ?? ""}
                  onChange={(e) =>
                    handleMappingChange("priority", e.target.value)
                  }
                >
                  <option value="">—</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-1 text-[11px] text-slate-400">Tags</p>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  value={mapping.tags ?? ""}
                  onChange={(e) =>
                    handleMappingChange("tags", e.target.value)
                  }
                >
                  <option value="">—</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-1 text-[11px] text-slate-400">
                  Angle Chefito
                </p>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  value={mapping.chefito_angle ?? ""}
                  onChange={(e) =>
                    handleMappingChange("chefito_angle", e.target.value)
                  }
                >
                  <option value="">—</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {importRows.length > 0 && (
          <div className="space-y-3 text-xs">
            <p className="font-semibold text-slate-200">
              2. Prévisualisation des 10 premières lignes
            </p>
            <p className="text-[11px] text-slate-500">
              Lignes valides :{" "}
              <span className="text-emerald-300">{validRows.length}</span> •
              Lignes avec erreurs :{" "}
              <span className="text-red-300">{invalidRows.length}</span>
            </p>

            <div className="max-h-72 overflow-auto rounded-md border border-slate-800 bg-slate-950/40">
              <table className="min-w-full divide-y divide-slate-800 text-[11px]">
                <thead className="bg-slate-900/80 text-slate-400">
                  <tr>
                    <th className="px-3 py-2 text-left">Ligne</th>
                    <th className="px-3 py-2 text-left">Titre</th>
                    <th className="px-3 py-2 text-left">Mois</th>
                    <th className="px-3 py-2 text-left">Statut</th>
                    <th className="px-3 py-2 text-left">Priorité</th>
                    <th className="px-3 py-2 text-left">Erreurs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {previewRows.map((row) => (
                    <tr key={row.index}>
                      <td className="px-3 py-2 align-top text-slate-500">
                        {row.index + 1}
                      </td>
                      <td className="px-3 py-2 align-top text-slate-100">
                        {row.title}
                      </td>
                      <td className="px-3 py-2 align-top text-slate-400">
                        {row.targetMonth || "—"}
                      </td>
                      <td className="px-3 py-2 align-top text-slate-400">
                        {row.status}
                      </td>
                      <td className="px-3 py-2 align-top text-slate-400">
                        {row.priority}
                      </td>
                      <td className="px-3 py-2 align-top text-slate-400">
                        {row.errors.length === 0 ? (
                          <span className="text-emerald-300">OK</span>
                        ) : (
                          row.errors.join("; ")
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="primary"
                className="inline-flex items-center gap-2 text-xs"
                disabled={
                  importMutation.isPending ||
                  importRows.length === 0 ||
                  validRows.length === 0
                }
                onClick={handleImport}
              >
                {importMutation.isPending && (
                  <LoadingSpinner size="sm" className="text-slate-100" />
                )}
                <span>
                  Importer {validRows.length} ligne(s) valide(s) dans le
                  calendrier
                </span>
              </Button>

              {invalidRows.length > 0 && (
                <p className="text-[11px] text-amber-300">
                  Les lignes avec erreurs ne seront pas importées.
                </p>
              )}
            </div>

            {importMutation.isError && (
              <p className="text-[11px] text-red-300">
                {(importMutation.error as any)?.message ??
                  "Erreur lors de l'import CSV."}
              </p>
            )}
            {importMutation.isSuccess && (
              <p className="text-[11px] text-emerald-300">
                Import terminé. Le calendrier éditorial a été mis à jour.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminEditorialImportPage;