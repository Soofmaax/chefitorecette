import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { triggerEmbedding } from "@/lib/embeddings";

interface Article {
  id: string;
  title: string;
  created_at: string;
  enrichment_status: string | null;
}

const ArticlesListPage = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchArticles = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("posts")
        .select("id, title, created_at, enrichment_status")
        .order("created_at", { ascending: false })
        .limit(50);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">
            Articles
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Liste des articles, avec leur statut d’enrichissement RAG.
          </p>
        </div>
        <Link href="/articles/new" legacyBehavior>
          <a>
            <Button variant="primary">Nouvel article</Button>
          </a>
        </Link>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-800 px-4 py-3 text-xs text-slate-400">
          {loading
            ? "Chargement des articles…"
            : `${articles.length} articles (limités aux 50 plus récents)`}
        </div>

        <div className="max-h-[480px] overflow-auto text-sm">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-2 text-left">Titre</th>
                <th className="px-4 py-2 text-left">Créé le</th>
                <th className="px-4 py-2 text-left">Statut RAG</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40">
              {loading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-slate-400"
                  >
                    <LoadingSpinner className="mr-2 inline-block" />
                    Chargement…
                  </td>
                </tr>
              ) : articles.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    Aucun article trouvé.
                  </td>
                </tr>
              ) : (
                articles.map((article) => (
                  <tr key={article.id}>
                    <td className="px-4 py-2">
                      <span className="font-medium text-slate-100">
                        {article.title}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-400">
                      {article.created_at
                        ? new Date(article.created_at).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-400">
                      {statusLabel(article.enrichment_status)}
                    </td>
                    <td className="px-4 py-2 text-right">
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ArticlesListPage;