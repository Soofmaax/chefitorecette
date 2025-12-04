import { useEffect, useState } from "react";
import {
  getRedisStats,
  getS3Stats,
  getVaultStats,
  listCronJobs,
  createCronJob
} from "@/lib/integrations";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface CronJob {
  name: string;
  schedule: string;
  description?: string;
  enabled?: boolean;
  [key: string]: any;
}

const IntegrationsPage = () => {
  const [redisStats, setRedisStats] = useState<any | null>(null);
  const [s3Stats, setS3Stats] = useState<any | null>(null);
  const [vaultStats, setVaultStats] = useState<any | null>(null);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [cronLoading, setCronLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    setLoading(true);
    setError(null);

    try {
      const [redis, s3, vault, cron] = await Promise.all([
        getRedisStats(),
        getS3Stats(),
        getVaultStats(),
        listCronJobs()
      ]);

      setRedisStats(redis);
      setS3Stats(s3);
      setVaultStats(vault);
      setCronJobs(((cron as any)?.jobs as CronJob[]) ?? []);
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError(
        err?.message ?? "Erreur lors du chargement des intégrations."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const setupAutomaticRAGJobs = async () => {
    setCronLoading(true);
    setError(null);

    const jobs: CronJob[] = [
      {
        name: "cleanup-redis-cache",
        schedule: "0 2 * * *",
        description: "Nettoyage du cache Redis",
        enabled: true
      },
      {
        name: "sync-s3-embeddings",
        schedule: "0 3 * * 0",
        description: "Synchronisation hebdomadaire des embeddings S3",
        enabled: true
      },
      {
        name: "backup-vault-data",
        schedule: "0 4 1 * *",
        description: "Sauvegarde mensuelle des données Vault",
        enabled: true
      }
    ];

    try {
      for (const job of jobs) {
        await createCronJob(job);
      }

      await loadStats();
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError(
        err?.message ?? "Erreur lors de la configuration des tâches Cron."
      );
    } finally {
      setCronLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-50">
          Intégrations RAG (Redis, S3, Vault, Cron)
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Supervision des intégrations pour le système RAG : cache Redis,
          stockage d&apos;embeddings S3, chiffrement Vault et tâches Cron
          automatiques.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <LoadingSpinner />
          <span className="ml-2 text-sm text-slate-400">
            Chargement des métriques d’intégration…
          </span>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="card px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Redis Cache
              </p>
              <p className="mt-2 text-sm text-slate-200">
                {redisStats ? "En ligne" : "Indisponible"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Hit ratio :{" "}
                {redisStats?.hitRatio != null
                  ? `${Math.round(redisStats.hitRatio * 100)}%`
                  : "N/A"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Clés actives : {redisStats?.keys ?? "N/A"}
              </p>
            </div>

            <div className="card px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                S3 Vectors
              </p>
              <p className="mt-2 text-sm text-slate-200">
                {s3Stats ? "En ligne" : "Indisponible"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Vecteurs stockés : {s3Stats?.vectors ?? "N/A"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Utilisation : {s3Stats?.used ?? "N/A"}
              </p>
            </div>

            <div className="card px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Vault Security
              </p>
              <p className="mt-2 text-sm text-slate-200">
                {vaultStats ? "En ligne" : "Indisponible"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Objets chiffrés :{" "}
                {vaultStats?.encryptedCount ?? "N/A"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Dernière rotation de clé :{" "}
                {vaultStats?.lastKeyRotation ?? "N/A"}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  Tâches Cron RAG
                </h2>
                <p className="text-xs text-slate-400">
                  Configurez les tâches automatiques pour nettoyage de cache,
                  synchronisation S3 et sauvegardes Vault.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="text-xs"
                onClick={setupAutomaticRAGJobs}
                disabled={cronLoading}
              >
                {cronLoading && (
                  <LoadingSpinner size="sm" className="mr-2" />
                )}
                Configurer les tâches automatiques
              </Button>
            </div>

            <div className="card max-h-[320px] overflow-auto px-4 py-4 text-sm">
              {cronJobs.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Aucune tâche Cron trouvée pour le moment.
                </p>
              ) : (
                <table className="min-w-full divide-y divide-slate-800">
                  <thead className="bg-slate-900/80 text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-3 py-2 text-left">Nom</th>
                      <th className="px-3 py-2 text-left">Schedule</th>
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-left">Actif</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-950/40">
                    {cronJobs.map((job) => (
                      <tr key={job.name}>
                        <td className="px-3 py-2 text-xs">
                          {job.name}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-300">
                          {job.schedule}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-400">
                          {job.description ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-300">
                          {job.enabled ? "Oui" : "Non"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default IntegrationsPage;