import { useEffect, useState } from "react";
import {
  cacheContentInRedis,
  encryptSensitiveData,
  getS3Stats,
  getRedisStats,
  getVaultStats,
  storeEmbeddingInS3
} from "@/lib/integrations";

interface IntegrationsState {
  isRedisConnected: boolean;
  isVaultAvailable: boolean;
  s3Stats: any | null;
  redisStats: any | null;
  vaultStats: any | null;
}

export const useIntegrations = () => {
  const [state, setState] = useState<IntegrationsState>({
    isRedisConnected: false,
    isVaultAvailable: false,
    s3Stats: null,
    redisStats: null,
    vaultStats: null
  });

  useEffect(() => {
    let mounted = true;

    const fetchStatus = async () => {
      try {
        const [redis, s3, vault] = await Promise.allSettled([
          getRedisStats(),
          getS3Stats(),
          getVaultStats()
        ]);

        if (!mounted) return;

        const redisData =
          redis.status === "fulfilled" ? redis.value : null;
        const s3Data = s3.status === "fulfilled" ? s3.value : null;
        const vaultData =
          vault.status === "fulfilled" ? vault.value : null;

        setState({
          isRedisConnected: !!redisData,
          isVaultAvailable: !!vaultData,
          s3Stats: s3Data,
          redisStats: redisData,
          vaultStats: vaultData
        });
      } catch {
        if (!mounted) return;
        setState((prev) => ({
          ...prev,
          isRedisConnected: false,
          isVaultAvailable: false
        }));
      }
    };

    fetchStatus();

    return () => {
      mounted = false;
    };
  }, []);

  return {
    ...state,
    storeInS3: storeEmbeddingInS3,
    cacheInRedis: cacheContentInRedis,
    encryptWithVault: encryptSensitiveData
  };
};