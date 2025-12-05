"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useToast } from "@/components/ui/ToastProvider";

type CsvRow = Record&lt;string, string&gt;;

interface ParsedRow {
  index: number;
  values: CsvRow;
}

interface UtensilImportRow {
  index: number;
  key: string;
  label: string;
  errors: string[];
}

interface ColumnMapping {
  key: string | null;
  label: string | null;
}

const normalizeHeader = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const guessColumnMapping = (headers: string[]): ColumnMapping =&gt; {
  const find = (candidates: string[]): string | null =&gt; {
    const normalizedHeaders = headers.map((h) =&gt; normalizeHeader(h));
    for (const candidate of candidates) {
      const needle = normalizeHeader(candidate);
      const idx = normalizedHeaders.findIndex((h) =&gt; h.includes(needle));
      if (idx !== -1) {
        return headers[idx];
      }
    }
    return null;
  };

  return {
    key: find(["key", "cle", "clé", "identifiant"]),
    label: find(["label", "nom", "intitule", "intitulé"])
  };
};

const parseCsv = (text: string): { headers: string[]; rows: ParsedRow[] } =&gt; {
  const lines = text
    .split(/\r?\n/)
    .map((l) =&gt; l.trim())
    .filter((l) =&gt; l.length &gt; 0);

  if (lines.length === 0) {
    throw new Error("Le fichier CSV est vide.");
  }

  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semiCount &gt; commaCount ? ";" : ",";

  const headers = firstLine.split(delimiter).map((h) =&gt; h.trim());
  const rows: ParsedRow[] = [];

  for (let i = 1; i &lt; lines.length; i += 1) {
    const raw = lines[i];
    if (!raw) continue;
    const parts = raw.split(delimiter);
    const row: CsvRow = {};
    headers.forEach((h, idx) =&gt; {
      row[h] = (parts[idx] ?? "").trim();
    });
    rows.push({ index: i, values: row });
  }

  return { headers, rows };
};

const buildImportRows = (
  parsed: ParsedRow[],
  mapping: ColumnMapping
): UtensilImportRow[] =&gt; {
  return parsed.map((row) =&gt; {
    const get = (columnName: string | null): string =&gt; {
      if (!columnName) return "";
      return row.values[columnName] ?? "";
    };

    const keyRaw = get(mapping.key);
    const labelRaw = get(mapping.label);

    const errors: string[] = [];

    const key = keyRaw.trim();
    if (!key) {
      errors.push("Clé (key) manquante");
    }

    const label = labelRaw.trim();
    if (!label) {
      errors.push("Label manquant");
    }

    return {
      index: row.index,
      key,
      label,
      errors
    };
  });
};

const AdminUtensilsImportPage = () =&gt; {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { showToast } = useToast();

  const [fileName, setFileName] = useState&lt;string | null&gt;(null);
  const [headers, setHeaders] = useState&lt;string[]&gt;([]);
  const [parsedRows, setParsedRows] = useState&lt;ParsedRow[]&gt;([]);
  const [mapping, setMapping] = useState&lt;ColumnMapping | null&gt;(null);
  const [parseError, setParseError] = useState&lt;string | null&gt;(null);

  const importRows = useMemo(() =&gt; {
    if (!mapping) return [];
    if (parsedRows.length === 0) return [];
    return buildImportRows(parsedRows, mapping);
  }, [parsedRows, mapping]);

  const validRows = useMemo(
    () =&gt; importRows.filter((r) =&gt; r.errors.length === 0),
    [importRows]
  );
  const invalidRows = useMemo(
    () =&gt; importRows.filter((r) =&gt; r.errors.length &gt; 0),
    [importRows]
  );

  const importMutation = useMutation({
    mutationFn: async (rows: UtensilImportRow[]) =&gt; {
      const payload = rows
        .filter((r) =&gt; r.errors.length === 0)
        .map((r) =&gt; ({
          key: r.key,
          label: r.label
        }));

      if (payload.length === 0) {
        throw new Error(
          "Aucune ligne valide à importer. Corrige les erreurs du CSV."
        );
      }

      const { error } = await supabase
        .from("utensils_catalog")
        .upsert(payload, { onConflict: "key" });

      if (error) {
        throw error;
      }
    },
    onSuccess: () =&gt; {
      queryClient.invalidateQueries({ queryKey: ["utensils-catalog"] });
      showToast({
        type: "success",
        message: "Import CSV des ustensiles terminé avec succès."
      });
      router.push("/admin/utensils?import=success");
    },
    onError: (err: any) =&gt; {
      const msg =
        err?.message ?? "Erreur lors de l'import CSV des ustensiles.";
      showToast({
        type: "error",
        message: msg
      });
    }
  });

  const handleFileChange = async (
    event: React.ChangeEvent&lt;HTMLInputElement&gt;
  ) =&gt; {
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

  const handleMappingChange = (field: keyof ColumnMapping, column: string) =&gt; {
    setMapping((prev) =&gt; {
      if (!prev) return prev;
      return {
        ...prev,
        [field]: column || null
      };
    });
  };

  const handleImport = async () =&gt; {
    if (importRows.length === 0 || validRows.length === 0) return;
    try {
      await importMutation.mutateAsync(importRows);
    } catch {
      // handled by mutation
    }
  };

  const previewRows = importRows.slice(0, 20);

  return (
    &lt;div className="space-y-6"&gt;
      &lt;div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"&gt;
        &lt;div&gt;
          &lt;h1 className="text-xl font-semibold tracking-tight text-slate-50"&gt;
            Import CSV – Ustensiles / matériel
          &lt;/h1&gt;
          &lt;p className="mt-1 text-sm text-slate-400"&gt;
            Importe ou mets à jour le catalogue d&apos;ustensiles à partir
            d&apos;un fichier CSV. Les lignes sont insérées ou mises à jour
            selon la clé.
          &lt;/p&gt;
          &lt;p className="mt-1 text-xs text-slate-500"&gt;
            Clé de déduplication :{" "}
            &lt;code className="rounded bg-slate-800 px-1 text-[11px]"&gt;
              key
            &lt;/code&gt;
            . Si une clé existe déjà, la ligne correspondante est mise à jour.
          &lt;/p&gt;
        &lt;/div&gt;
      &lt;/div&gt;

      &lt;div className="card space-y-4 px-4 py-4"&gt;
        &lt;div className="space-y-2"&gt;
          &lt;label
            htmlFor="csv_file"
            className="text-xs font-semibold text-slate-200"
          &gt;
            Fichier CSV
          &lt;/label&gt;
          &lt;input
            id="csv_file"
            type="file"
            accept=".csv,text/csv"
            className="w-full text-sm text-slate-200 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-100 hover:file:bg-slate-700"
            onChange={handleFileChange}
          /&gt;
          {fileName &amp;&amp; (
            &lt;p className="text-xs text-slate-500"&gt;
              Fichier sélectionné : {fileName}
            &lt;/p&gt;
          )}
          {parseError &amp;&amp; (
            &lt;p className="text-xs text-red-300"&gt;{parseError}&lt;/p&gt;
          )}
        &lt;/div&gt;

        {headers.length &gt; 0 &amp;&amp; mapping &amp;&amp; (
          &lt;div className="space-y-3 text-xs"&gt;
            &lt;p className="font-semibold text-slate-200"&gt;
              1. Mapping automatique des colonnes
            &lt;/p&gt;
            &lt;p className="text-[11px] text-slate-500"&gt;
              Vérifie que chaque champ du catalogue est correctement associé à
              une colonne du CSV. Tu peux modifier le mapping si besoin.
            &lt;/p&gt;

            &lt;div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3"&gt;
              &lt;div&gt;
                &lt;p className="mb-1 text-[11px] text-slate-400"&gt;Clé&lt;/p&gt;
                &lt;select
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  value={mapping.key ?? ""}
                  onChange={(e) =&gt;
                    handleMappingChange("key", e.target.value)
                  }
                &gt;
                  &lt;option value=""&gt;—&lt;/option&gt;
                  {headers.map((h) =&gt; (
                    &lt;option key={h} value={h}&gt;
                      {h}
                    &lt;/option&gt;
                  ))}
                &lt;/select&gt;
              &lt;/div&gt;

              &lt;div&gt;
                &lt;p className="mb-1 text-[11px] text-slate-400"&gt;
                  Label affiché
                &lt;/p&gt;
                &lt;select
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  value={mapping.label ?? ""}
                  onChange={(e) =&gt;
                    handleMappingChange("label", e.target.value)
                  }
                &gt;
                  &lt;option value=""&gt;—&lt;/option&gt;
                  {headers.map((h) =&gt; (
                    &lt;option key={h} value={h}&gt;
                      {h}
                    &lt;/option&gt;
                  ))}
                &lt;/select&gt;
              &lt;/div&gt;
            &lt;/div&gt;
          &lt;/div&gt;
        )}

        {importRows.length &gt; 0 &amp;&amp; (
          &lt;div className="space-y-3 text-xs"&gt;
            &lt;p className="font-semibold text-slate-200"&gt;
              2. Prévisualisation des 20 premières lignes
            &lt;/p&gt;
            &lt;p className="text-[11px] text-slate-500"&gt;
              Lignes valides :{" "}
              &lt;span className="text-emerald-300"&gt;{validRows.length}&lt;/span&gt; •
              Lignes avec erreurs :{" "}
              &lt;span className="text-red-300"&gt;{invalidRows.length}&lt;/span&gt;
            &lt;/p&gt;

            &lt;div className="max-h-72 overflow-auto rounded-md border border-slate-800 bg-slate-950/40"&gt;
              &lt;table className="min-w-full divide-y divide-slate-800 text-[11px]"&gt;
                &lt;thead className="bg-slate-900/80 text-slate-400"&gt;
                  &lt;tr&gt;
                    &lt;th className="px-3 py-2 text-left"&gt;Ligne&lt;/th&gt;
                    &lt;th className="px-3 py-2 text-left"&gt;Clé&lt;/th&gt;
                    &lt;th className="px-3 py-2 text-left"&gt;Label&lt;/th&gt;
                    &lt;th className="px-3 py-2 text-left"&gt;Erreurs&lt;/th&gt;
                  &lt;/tr&gt;
                &lt;/thead&gt;
                &lt;tbody className="divide-y divide-slate-800"&gt;
                  {previewRows.map((row) =&gt; (
                    &lt;tr key={row.index}&gt;
                      &lt;td className="px-3 py-2 align-top text-slate-500"&gt;
                        {row.index + 1}
                      &lt;/td&gt;
                      &lt;td className="px-3 py-2 align-top text-slate-100"&gt;
                        {row.key}
                      &lt;/td&gt;
                      &lt;td className="px-3 py-2 align-top text-slate-100"&gt;
                        {row.label}
                      &lt;/td&gt;
                      &lt;td className="px-3 py-2 align-top text-slate-400"&gt;
                        {row.errors.length === 0 ? (
                          &lt;span className="text-emerald-300"&gt;OK&lt;/span&gt;
                        ) : (
                          row.errors.join("; ")
                        )}
                      &lt;/td&gt;
                    &lt;/tr&gt;
                  ))}
                &lt;/tbody&gt;
              &lt;/table&gt;
            &lt;/div&gt;

            &lt;div className="flex items-center justify-between gap-3"&gt;
              &lt;Button
                type="button"
                variant="primary"
                className="inline-flex items-center gap-2 text-xs"
                disabled={
                  importMutation.isPending ||
                  importRows.length === 0 ||
                  validRows.length === 0
                }
                onClick={handleImport}
              &gt;
                {importMutation.isPending &amp;&amp; (
                  &lt;LoadingSpinner size="sm" className="text-slate-100" /&gt;
                )}
                &lt;span&gt;
                  Importer / mettre à jour {validRows.length} ligne(s) valide(s)
                &lt;/span&gt;
              &lt;/Button&gt;

              {invalidRows.length &gt; 0 &amp;&amp; (
                &lt;p className="text-[11px] text-amber-300"&gt;
                  Les lignes avec erreurs ne seront pas importées.
                &lt;/p&gt;
              )}
            &lt;/div&gt;

            {importMutation.isError &amp;&amp; (
              &lt;p className="text-[11px] text-red-300"&gt;
                {(importMutation.error as any)?.message ??
                  "Erreur lors de l'import CSV."}
              &lt;/p&gt;
            )}
            {importMutation.isSuccess &amp;&amp; (
              &lt;p className="text-[11px] text-emerald-300"&gt;
                Import terminé. Le catalogue d&apos;ustensiles a été mis à jour.
              &lt;/p&gt;
            )}
          &lt;/div&gt;
        )}
      &lt;/div&gt;
    &lt;/div&gt;
  );
};

export default AdminUtensilsImportPage;