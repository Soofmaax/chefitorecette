import { useEffect, useState } from "react";
import {
  cacheContentInRedis,
  getRedisStats,
  getS3Stats,
  getVaultStats,
  encryptSensitiveData,
  storeEmbeddingInS3
} from "@/lib/integrations";

export interface IntegrationStats {
  redis: any | null;
  s3: any | null;
  vault: any | null;
}

export const useIntegrations = () => {
  const [stats, setStats] = useState<IntegrationStats>({
    redis: null,
    s3: null,
    vault: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);

    try {
      const [redis, s3, vault] = await Promise.all([
        getRedisStats(),
        getS3Stats(),
        getVaultStats()
      ]);

      setStats({
        redis,
        s3,
        vault
      });
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError(err?.message ?? "Erreur lors du chargement des intégrations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return {
    loading,
    error,
    stats,
    refresh,
    // helpers exposés pour réutilisation dans les formulaires
    cacheContentInRedis,
    encryptSensitiveData,
    storeEmbeddingInS3
  };
};