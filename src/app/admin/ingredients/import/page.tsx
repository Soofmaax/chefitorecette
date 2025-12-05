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

interface IngredientImportRow {
  index: number;
  canonical_name: string;
  display_name: string;
  category: string | null;
  scientific_name: string | null;
  audio_key: string | null;
  errors: string[];
}

interface ColumnMapping {
  canonical_name: string | null;
  display_name: string | null;
  category: string | null;
  scientific_name: string | null;
  audio_key: string | null;
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
    canonical_name: find(["canonical_name", "nom_canonique", "key"]),
    display_name: find(["display_name", "label_fr", "nom_affiche", "nom"]),
    category: find(["category", "categorie", "catégorie"]),
    scientific_name: find(["scientific_name", "nom_scientifique"]),
    audio_key: find(["audio_key", "audio", "cle_audio", "clé_audio"])
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

const buildImportRows = (
  parsed: ParsedRow[],
  mapping: ColumnMapping
): IngredientImportRow[] => {
  return parsed.map((row) => {
    const get = (columnName: string | null): string => {
      if (!columnName) return "";
      return row.values[columnName] ?? "";
    };

    const canonicalRaw = get(mapping.canonical_name);
    const displayRaw = get(mapping.display_name);
    const categoryRaw = get(mapping.category);
    const scientificRaw = get(mapping.scientific_name);
    const audioRaw = get(mapping.audio_key);

    const errors: string[] = [];

    const canonical_name = canonicalRaw.trim();
    if (!canonical_name) {
      errors.push("Nom canonique manquant");
    }

    const display_name = displayRaw.trim();
    if (!display_name) {
      errors.push("Nom affiché manquant");
    }

    const category = categoryRaw.trim() || null;
    const scientific_name = scientificRaw.trim() || null;
    const audio_key = audioRaw.trim() || null;

    return {
      index: row.index,
      canonical_name,
      display_name,
      category,
      scientific_name,
      audio_key,
      errors
    };
  });
};

const AdminIngredientsImportPage = () => {
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
    mutationFn: async (rows: IngredientImportRow[]) => {
      const payload = rows
        .filter((r) => r.errors.length === 0)
        .map((r) => ({
          canonical_name: r.canonical_name,
          display_name: r.display_name,
          category: r.category,
          scientific_name: r.scientific_name,
          audio_key: r.audio_key
        }));

      if (payload.length === 0) {
        throw new Error(
          "Aucune ligne valide à importer. Corrige les erreurs du CSV."
        );
      }

      const { error } = await supabase
        .from("ingredients_catalog")
        .upsert(payload, { onConflict: "canonical_name" });

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingredients-catalog"] });
      showToast({
        type: "success",
        message: "Import CSV des ingrédients terminé avec succès."
      });
      router.push("/admin/ingredients?import=success");
    },
    onError: (err: any) => {
      const msg =
        err?.message ?? "Erreur lors de l'import CSV des ingrédients.";
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
            Import CSV – Catalogue d&apos;ingrédients
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Importe ou mets à jour le catalogue d&apos;ingrédients à partir
            d&apos;un fichier CSV. Les lignes sont insérées ou mises à jour
            selon le nom canonique.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Clé de déduplication :{" "}
            <code className="rounded bg-slate-800 px-1 text-[11px]">
              canonical_name
            </code>
            . Si un nom canonique existe déjà, la ligne correspondante est
            mise à jour.
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
              Vérifie que chaque champ du catalogue est correctement associé à
              une colonne du CSV. Tu peux modifier le mapping si besoin.
            </p>

            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="mb-1 text-[11px] text-slate-400">
                  Nom canonique
                </p>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  value={mapping.canonical_name ?? ""}
                  onChange={(e) =>
                    handleMappingChange("canonical_name", e.target.value)
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
                <p className="mb-1 text-[11px] text-slate-400">Nom affiché</p>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  value={mapping.display_name ?? ""}
                  onChange={(e) =>
                    handleMappingChange("display_name", e.target.value)
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
                <p className="mb-1 text-[11px] text-slate-400">
                  Nom scientifique
                </p>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  value={mapping.scientific_name ?? ""}
                  onChange={(e) =>
                    handleMappingChange("scientific_name", e.target.value)
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
                <p className="mb-1 text-[11px] text-slate-400">Clé audio</p>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  value={mapping.audio_key ?? ""}
                  onChange={(e) =>
                    handleMappingChange("audio_key", e.target.value)
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
                    <th className="px-3 py-2 text-left">Nom canonique</th>
                    <th className="px-3 py-2 text-left">Nom affiché</th>
                    <th className="px-3 py-2 text-left">Catégorie</th>
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
                        {row.canonical_name}
                      </td>
                      <td className="px-3 py-2 align-top text-slate-100">
                        {row.display_name}
                      </td>
                      <td className="px-3 py-2 align-top text-slate-400">
                        {row.category ?? "—"}
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
                Import terminé. Le catalogue d&apos;ingrédients a été mis à
                jour.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminIngredientsImportPage;