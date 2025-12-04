import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { triggerEmbedding } from "@/lib/embeddings";

interface Article {
  id: string;
  title: string;
  slug: string;
  status: string;
  created_at: string;
  published_at: string | null;
  enrichment_status: string | null;
  cache_key?: string | null;
  rag_metadata?: {
    processed_at?: string;
    embedding_model?: string;
    embedding_dimensions?: number;
    [key: string]: any;
  } | null;
}

type FilterStatus = "all" | "completed" | "pending" | "failed";

const ArticlesListPage = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>("all");

  useEffect(() => {
    const fetchArticles = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("posts")
        .select(
          "id, title, slug, status, created_at, published_at, enrichment_status, cache_key, rag_metadata"
        )
        .order("created_at", { ascending: false })
        .limit(200);

      if (!error && data) {
        setArticles(data as Article[]);
      }

      setLoading(false);
    };

    fetchArticles();
  }, []);

  const handleReEnrich = async (id: string) => {
    try {
      setUpdatingId(id);
      await triggerEmbedding("post", id);
      // eslint-disable-next-line no-console
      console.log("Enrichissement déclenché pour l’article", id);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      alert("Erreur lors du déclenchement de l’enrichissement.");
    } finally {
      setUpdatingId(null);
    }
  };

  const statusLabel = (status: string | null) => {
    switch (status) {
      case "completed":
        return (
          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
            Enrichi
          </span>
        );
      case "pending":
        return (
          <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">
            En attente
          </span>
        );
      case "failed":
        return (
          <span className="rounded bg-red-500/10 px-2 py-0.5 text-xs text-red-200">
            Échec
          </span>
        );
      default:
        return (
          <span className="rounded bg-slate-700/40 px-2 py-0.5 text-xs text-slate-300">
            Inconnu
          </span>
        );
    }
  };

  const filteredArticles = useMemo(() => {
    if (filter === "all") return articles;
    return articles.filter((a) => a.enrichment_status === filter);
  }, [articles, filter]);

  const total = articles.length;
  const completedCount = articles.filter(
    (a) => a.enrichment_status === "completed"
  ).length;
  const pendingCount = articles.filter(
    (a) => a.enrichment_status === "pending"
  ).length;
  const failedCount = articles.filter(
    (a) => a.enrichment_status === "failed"
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">
            Articles RAG
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Supervision des articles enrichis par le système RAG : statut,
            cache, métadonnées d&apos;embedding.
          </p>
          {total > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              {completedCount} / {total} articles enrichis • {pendingCount} en
              attente • {failedCount} en échec
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-slate-800 bg-slate-900/60 text-xs">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 ${
                filter === "all"
                  ? "bg-primary-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              Tous
            </button>
            <button
              type="button"
              onClick={() => setFilter("completed")}
              className={`px-3 py-1.5 ${
                filter === "completed"
                  ? "bg-primary-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              Enrichis
            </button>
            <button
              type="button"
              onClick={() => setFilter("pending")}
              className={`px-3 py-1.5 ${
                filter === "pending"
                  ? "bg-primary-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              En attente
            </button>
            <button
              type="button"
              onClick={() => setFilter("failed")}
              className={`px-3 py-1.5 ${
                filter === "failed"
                  ? "bg-primary-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              Échec
            </button>
          </div>

          <Link href="/articles/new" legacyBehavior>
            <a>
              <Button variant="primary">Nouvel article</Button>
            </a>
          </Link>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-800 px-4 py-3 text-xs text-slate-400">
          {loading
            ? "Chargement des articles…"
            : `${filteredArticles.length} articles affichés (sur ${total}, limités aux 200 plus récents)`}
        </div>

        <div className="max-h-[520px] overflow-auto text-sm">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-2 text-left">Titre</th>
                <th className="px-4 py-2 text-left">Statut</th>
                <th className="px-4 py-2 text-left">Créé le</th>
                <th className="px-4 py-2 text-left">Publié le</th>
                <th className="px-4 py-2 text-left">Statut RAG</th>
                <th className="px-4 py-2 text-left">Cache</th>
                <th className="px-4 py-2 text-left">Embedding</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-slate-400"
                  >
                    <LoadingSpinner className="mr-2 inline-block" />
                    Chargement…
                  </td>
                </tr>
              ) : filteredArticles.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    Aucun article trouvé pour ce filtre.
                  </td>
                </tr>
              ) : (
                filteredArticles.map((article) => {
                  const processedAt =
                    article.rag_metadata &&
                    (article.rag_metadata as any).processed_at;
                  const model =
                    article.rag_metadata &&
                    (article.rag_metadata as any).embedding_model;
                  const dims =
                    article.rag_metadata &&
                    (article.rag_metadata as any).embedding_dimensions;

                  return (
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
                      <td className="px-4 py-2 align-top text-slate-400">
                        {article.status}
                      </td>
                      <td className="px-4 py-2 align-top text-slate-400">
                        {article.created_at
                          ? new Date(article.created_at).toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-4 py-2 align-top text-slate-400">
                        {article.published_at
                          ? new Date(article.published_at).toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-4 py-2 align-top text-slate-400">
                        {statusLabel(article.enrichment_status)}
                      </td>
                      <td className="px-4 py-2 align-top text-slate-400">
                        {article.cache_key ? (
                          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
                            {article.cache_key}
                          </span>
                        ) : (
                          <span className="rounded bg-slate-700/40 px-2 py-0.5 text-xs text-slate-300">
                            Non en cache
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 align-top text-slate-400">
                        {processedAt ? (
                          <div className="space-y-1 text-xs">
                            <div>
                              <span className="text-slate-500">
                                Traitée le{" "}
                              </span>
                              <span className="text-slate-200">
                                {new Date(
                                  processedAt as string
                                ).toLocaleString()}
                              </span>
                            </div>
                            {model && (
                              <div>
                                <span className="text-slate-500">
                                  Modèle :{" "}
                                </span>
                                <span className="text-slate-200">
                                  {model}
                                </span>
                              </div>
                            )}
                            {dims && (
                              <div>
                                <span className="text-slate-500">
                                  Dimensions :{" "}
                                </span>
                                <span className="text-slate-200">
                                  {dims}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">
                            Aucune métadonnée RAG disponible.
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 align-top text-right">
                        <Button
                          type="button"
                          variant="secondary"
                          className="inline-flex items-center gap-2 text-xs"
                          onClick={() => handleReEnrich(article.id)}
                          disabled={updatingId === article.id}
                        >
                          {updatingId === article.id && (
                            <LoadingSpinner size="sm" />
                          )}
                          <span>Relancer enrichissement</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ArticlesListPage;