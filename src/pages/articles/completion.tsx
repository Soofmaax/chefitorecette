import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface ArticleRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content_html: string | null;
  cover_image_url: string | null;
  tags: string[] | null;
  category: string | null;
  content_text: string | null;
  author_info: string | null;
  key_concepts: string[] | null;
  rag_metadata: any | null;
  enrichment_status: string | null;
  status: string;
}

interface ArticleWithMissing extends ArticleRow {
  missingFields: string[];
}

const FIELDS_TO_CHECK: { key: keyof ArticleRow; label: string }[] = [
  { key: "excerpt", label: "Extrait" },
  { key: "cover_image_url", label: "Image de couverture" },
  { key: "tags", label: "Tags" },
  { key: "category", label: "Catégorie" },
  { key: "content_html", label: "Contenu HTML" },
  { key: "content_text", label: "Texte brut (RAG)" },
  { key: "author_info", label: "Infos auteur" },
  { key: "key_concepts", label: "Concepts clés" },
  { key: "rag_metadata", label: "Métadonnées RAG" }
];

const ArticlesCompletionPage = () => {
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArticles = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("posts")
        .select(
          "id, slug, title, excerpt, content_html, cover_image_url, tags, category, content_text, author_info, key_concepts, rag_metadata, enrichment_status, status"
        )
        .order("created_at", { ascending: false })
        .limit(500);

      if (!error && data) {
        setArticles(data as ArticleRow[]);
      }

      setLoading(false);
    };

    fetchArticles();
  }, []);

  const articlesWithMissing = useMemo<ArticleWithMissing[]>(() => {
    const result: ArticleWithMissing[] = articles.map((a) => {
      const missingFields: string[] = [];

      for (const field of FIELDS_TO_CHECK) {
        const value = a[field.key];
        if (value === null || value === undefined) {
          missingFields.push(field.label);
          continue;
        }
        if (typeof value === "string" && value.trim() === "") {
          missingFields.push(field.label);
          continue;
        }
        if (Array.isArray(value) && value.length === 0) {
          missingFields.push(field.label);
        }
      }

      return { ...a, missingFields };
    });

    return result.filter((a) => a.missingFields.length > 0);
  }, [articles]);

  const total = articles.length;
  const incompleteCount = articlesWithMissing.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">
            Articles à compléter
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Vue de travail pour repérer les champs manquants (NULL ou vides)
            dans vos articles éditoriaux, afin de les enrichir progressivement.
          </p>
          {total > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              {incompleteCount} / {total} articles ont encore des champs à
              compléter.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/articles" legacyBehavior>
            <a>
              <Button variant="secondary">Retour aux articles RAG</Button>
            </a>
          </Link>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-800 px-4 py-3 text-xs text-slate-400">
          {loading
            ? "Analyse des articles…"
            : `${articlesWithMissing.length} articles avec champs manquants (sur ${total})`}
        </div>

        <div className="max-h-[520px] overflow-auto text-sm">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-2 text-left">Article</th>
                <th className="px-4 py-2 text-left">Statut</th>
                <th className="px-4 py-2 text-left">Catégorie</th>
                <th className="px-4 py-2 text-left">Champs manquants</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40">
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-slate-400"
                  >
                    <LoadingSpinner className="mr-2 inline-block" />
                    Chargement…
                  </td>
                </tr>
              ) : articlesWithMissing.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    Tous les articles sont complets selon les critères actuels.
                  </td>
                </tr>
              ) : (
                articlesWithMissing.map((article) => (
                  <tr key={article.id}>
                    <td className="px-4 py-2 align-top">
                      <Link href={`/articles/${article.id}`} legacyBehavior>
                        <a className="font-medium text-slate-100 hover:underline">
                          {article.title}
                        </a>
                      </Link>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {article.slug}
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-slate-400">
                      {article.status}
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-slate-400">
                      {article.category || "—"}
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-slate-200">
                      <div className="flex flex-wrap gap-1">
                        {article.missingFields.map((field) => (
                          <span
                            key={field}
                            className="rounded bg-red-500/10 px-2 py-0.5 text-[11px] text-red-200"
                          >
                            {field}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top text-right">
                      <Link href={`/articles/${article.id}`} legacyBehavior>
                        <a>
                          <Button
                            type="button"
                            variant="secondary"
                            className="inline-flex items-center gap-2 text-xs"
                          >
                            Compléter
                          </Button>
                        </a>
                      </Link>
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

export default ArticlesCompletionPage;