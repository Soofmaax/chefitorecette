"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

interface KnowledgeImportRow {
  index: number;
  concept_key: string;
  title: string;
  category: string | null;
  work_status: string | null;
  difficulty_level: number | null;
  usage_priority: number | null;
  short_definition: string | null;
  long_explanation: string | null;
  synonyms: string[] | null;
  errors: string[];
}

interface ColumnMapping {
  concept_key: string | null;
  title: string | null;
  category: string | null;
  work_status: string | null;
  difficulty_level: string | null;
  usage_priority: string | null;
  short_definition: string | null;
  long_explanation: string | null;
  synonyms: string | null;
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
    concept_key: find([
      "concept_key",
      "key",
      "cle_concept",
      "clé_concept",
      "concept"
    ]),
    title: find(["title", "titre", "libelle", "libellé"]),
    category: find(["category", "categorie", "catégorie"]),
    work_status: find(["work_status", "statut", "status"]),
    difficulty_level: find(["difficulty", "difficulty_level", "difficulte"]),
    usage_priority: find(["usage_priority", "priorite", "priorité", "prio"]),
    short_definition: find(["short_definition", "definition_courte"]),
    long_explanation: find(["long_explanation", "explication_longue"]),
    synonyms: find(["synonyms", "synonymes", "mots_cles", "mots-clés"])
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

const mapWorkStatus = (value: string): string | null => {
  const v = value.toLowerCase();
  if (!v) return null;
  if (["not_started", "non demarre", "non démarré"].includes(v)) {
    return "not_started";
  }
  if (["researching", "en recherche", "recherche"].includes(v)) {
    return "researching";
  }
  if (["draft", "brouillon"].includes(v)) {
    return "draft";
  }
  if (["ready", "pret", "prêt"].includes(v)) {
    return "ready";
  }
  if (["published", "publie", "publié"].includes(v)) {
    return "published";
  }
  return null;
};

const buildImportRows = (
  parsed: ParsedRow[],
  mapping: ColumnMapping
): KnowledgeImportRow[] => {
  return parsed.map((row) => {
    const get = (columnName: string | null): string => {
      if (!columnName) return "";
      return row.values[columnName] ?? "";
    };

    const conceptKeyRaw = get(mapping.concept_key);
    const titleRaw = get(mapping.title);
    const categoryRaw = get(mapping.category);
    const statusRaw = get(mapping.work_status);
    const difficultyRaw = get(mapping.difficulty_level);
    const priorityRaw = get(mapping.usage_priority);
    const shortDefRaw = get(mapping.short_definition);
    const longExpRaw = get(mapping.long_explanation);
    const synonymsRaw = get(mapping.synonyms);

    const errors: string[] = [];

    const concept_key = conceptKeyRaw.trim();
    if (!concept_key) {
      errors.push("Clé de concept manquante");
    }

    const title = titleRaw.trim();
    if (!title) {
      errors.push("Titre manquant");
    }

    const category = categoryRaw.trim() || null;

    let work_status: string | null = "not_started";
    if (statusRaw.trim()) {
      const mapped = mapWorkStatus(statusRaw.trim());
      if (!mapped) {
        errors.push("Statut invalide");
        work_status = null;
      } else {
        work_status = mapped;
      }
    }

    let difficulty_level: number | null = null;
    if (difficultyRaw.trim()) {
      const n = Number(difficultyRaw);
      if (Number.isNaN(n) || n < 1 || n > 3) {
        errors.push("Difficulté invalide (attendu 1, 2 ou 3)");
      } else {
        difficulty_level = n;
      }
    }

    let usage_priority: number | null = null;
    if (priorityRaw.trim()) {
      const n = Number(priorityRaw);
      if (Number.isNaN(n)) {
        errors.push("Priorité d'usage invalide");
      } else {
        usage_priority = n;
      }
    }

    const short_definition = shortDefRaw.trim() || null;
    const long_explanation = longExpRaw.trim() || null;

    let synonyms: string[] | null = null;
    if (synonymsRaw.trim()) {
      const items = synonymsRaw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      synonyms = items.length > 0 ? items : null;
    }

    return {
      index: row.index,
      concept_key,
      title,
      category,
      work_status,
      difficulty_level,
      usage_priority,
      short_definition,
      long_explanation,
      synonyms,
      errors
    };
  });
};

const AdminKnowledgeImportPage = () => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { showToast } = useToast();

  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

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

  const importMutation = useMutation({
    mutationFn: async (rows: KnowledgeImportRow[]) => {
      const payload = rows
        .filter((r) => r.errors.length === 0)
        .map((r) => ({
          concept_key: r.concept_key,
          title: r.title,
          category: r.category,
          work_status: r.work_status,
          difficulty_level: r.difficulty_level,
          usage_priority: r.usage_priority,
          short_definition: r.short_definition,
          long_explanation: r.long_explanation,
          synonyms: r.synonyms
        }));

      if (payload.length === 0) {
        throw new Error(
          "Aucune ligne valide à importer. Corrige les erreurs du CSV."
        );
      }

      const { error } = await supabase
        .from("knowledge_base")
        .upsert(payload, { onConflict: "concept_key" });

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });
      showToast({
        type: "success",
        message: "Import CSV de la base de connaissances terminé avec succès."
      });
      router.push("/admin/knowledge?import=success");
    },
    onError: (err: any) => {
      const msg =
        err?.message ?? "Erreur lors de l'import CSV de la base de connaissances.";
      showToast({
        type: "error",
        message: msg
      });
    }
  });

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
    } catch {
      // handled by mutation
    }
  };

  const previewRows = importRows.slice(0, 20);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">
            Import CSV – Base de connaissances
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Importe ou mets à jour les concepts scientifiques Chefito à partir
            d&apos;un fichier CSV. Les lignes sont insérées ou mises à jour
            selon la clé de concept.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Clé de déduplication :{" "}
            <code className="rounded bg-slate-800 px-1 text-[11px]">
              concept_key
            </code>
            . Si une clé existe déjà, la ligne correspondante est mise à jour.
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
            <p className="text-xs text-slate-500">
              Fichier sélectionné : {fileName}
            </p>
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
              Vérifie que chaque champ du concept est correctement associé à une
              colonne du CSV. Tu peux modifier le mapping si besoin.
            </p>

            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="mb-1 text-[11px] text-slate-400">
                  Clé de concept
                </p>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  value={mapping.concept_key ?? ""}
                  onChange={(e) =>
                    handleMappingChange("concept_key", e.target.value)
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
                <p className="mb-1 text-[11px] text-slate-400">Statut</p>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  value={mapping.work_status ?? ""}
                  onChange={(e) =>
                    handleMappingChange("work_status", e.target.value)
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
                  Difficulté (1–3)
                </p>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  value={mapping.difficulty_level ?? ""}
                  onChange={(e) =>
                    handleMappingChange("difficulty_level", e.target.value)
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
                  Priorité d&apos;usage
                </p>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  value={mapping.usage_priority ?? ""}
                  onChange={(e) =>
                    handleMappingChange("usage_priority", e.target.value)
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

              <div className="md:col-span-2">
                <p className="mb-1 text-[11px] text-slate-400">
                  Définition courte
                </p>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  value={mapping.short_definition ?? ""}
                  onChange={(e) =>
                    handleMappingChange("short_definition", e.target.value)
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

              <div className="md:col-span-2">
                <p className="mb-1 text-[11px] text-slate-400">
                  Explication longue
                </p>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  value={mapping.long_explanation ?? ""}
                  onChange={(e) =>
                    handleMappingChange("long_explanation", e.target.value)
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

              <div className="md:col-span-2">
                <p className="mb-1 text-[11px] text-slate-400">
                  Synonymes (séparés par des virgules)
                </p>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  value={mapping.synonyms ?? ""}
                  onChange={(e) =>
                    handleMappingChange("synonyms", e.target.value)
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
              2. Prévisualisation des 20 premières lignes
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
                    <th className="px-3 py-2 text-left">Clé</th>
                    <th className="px-3 py-2 text-left">Titre</th>
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
                        {row.concept_key}
                      </td>
                      <td className="px-3 py-2 align-top text-slate-100">
                        {row.title}
                      </td>
                      <td className="px-3 py-2 align-top text-slate-400">
                        {row.usage_priority ?? "—"}
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
                  Importer / mettre à jour {validRows.length} ligne(s) valide(s)
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
                Import terminé. La base de connaissances a été mise à jour.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminKnowledgeImportPage;