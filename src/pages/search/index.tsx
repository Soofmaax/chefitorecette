import { useState } from "react";
import { searchContent, SemanticSearchResult } from "@/lib/search";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

const SearchPage = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [source, setSource] = useState<"cache" | "search" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const { results: newResults, source: newSource } = await searchContent(
        query
      );
      setResults(newResults);
      setSource(newSource);
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError(
        err?.message ?? "Erreur lors de la recherche sémantique."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-50">
          Recherche sémantique RAG
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Recherchez dans les recettes et articles. Les résultats peuvent
          provenir du cache Redis ou d’une recherche fraîche via les
          embeddings S3 et la fonction Edge post-similarity-search.
        </p>
      </div>

      <form
        onSubmit={handleSearch}
        className="card flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center"
      >
        <input
          className="w-full"
          placeholder="Tapez une question ou un thème (ex : recettes végétariennes rapides)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button
          type="submit"
          variant="primary"
          className="mt-2 w-full justify-center md:mt-0 md:w-auto"
          disabled={loading}
        >
          {loading && <LoadingSpinner size="sm" className="mr-2" />}
          Lancer la recherche
        </Button>
      </form>

      {error && (
        <p className="text-sm text-red-300">
          {error}
        </p>
      )}

      {source && (
        <p className="text-xs text-slate-500">
          Source des résultats :{" "}
          <span className="font-medium">
            {source === "cache" ? "cache Redis" : "recherche en direct"}
          </span>
        </p>
      )}

      <div className="card max-h-[520px] overflow-auto px-4 py-4 text-sm">
        {loading && (
          <div className="flex items-center justify-center py-8 text-slate-400">
            <LoadingSpinner className="mr-2" />
            Recherche en cours…
          </div>
        )}

        {!loading && results.length === 0 && !error && (
          <p className="text-slate-500">
            Aucun résultat à afficher. Lancez une recherche pour voir les
            contenus les plus pertinents.
          </p>
        )}

        {!loading && results.length > 0 && (
          <ul className="space-y-3">
            {results.map((item) => (
              <li
                key={item.id}
                className="rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2"
              >
                <p className="text-xs uppercase text-slate-500">
                  {item.type ?? (item.titre ? "recette" : "article")}
                </p>
                <p className="text-sm font-semibold text-slate-100">
                  {item.title ?? item.titre ?? "Sans titre"}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {item.excerpt ?? item.description ?? ""}
                </p>
                {typeof item.score === "number" && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Score de similarité :{" "}
                    {item.score.toFixed(3)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default SearchPage;