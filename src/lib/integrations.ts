import { supabase } from "./supabaseClient";

export const cacheContentInRedis = async (
  key: string,
  value: unknown,
  ttlSeconds = 3600
) => {
  const { data, error } = await supabase.functions.invoke("redis-wrapper", {
    body: {
      operation: "set",
      key,
      value: JSON.stringify(value),
      ttl: ttlSeconds
    }
  });

  if (error) {
    throw error;
  }

  return data;
};

export const getCachedValue = async (key: string) => {
  const { data, error } = await supabase.functions.invoke("redis-wrapper", {
    body: {
      operation: "get",
      key
    }
  });

  if (error) {
    throw error;
  }

  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }

  return data;
};

export const getRedisStats = async () => {
  const { data, error } = await supabase.functions.invoke("redis-wrapper", {
    body: { operation: "stats" }
  });

  if (error) {
    throw error;
  }

  return data;
};

export const getS3Stats = async () => {
  const { data, error } = await supabase.functions.invoke(
    "s3-vectors-wrapper",
    {
      body: { operation: "storage_stats" }
    }
  );

  if (error) {
    throw error;
  }

  return data;
};

export const getVaultStats = async () => {
  const { data, error } = await supabase.functions.invoke("vault-wrapper", {
    body: { operation: "encryption_stats" }
  });

  if (error) {
    throw error;
  }

  return data;
};

export const storeEmbeddingInS3 = async (
  contentType: "recipe" | "post",
  contentId: string,
  embedding: number[]
) => {
  const vectorKey = `embeddings/${contentType}/${contentId}.json`;

  const { data, error } = await supabase.functions.invoke(
    "s3-vectors-wrapper",
    {
      body: {
        operation: "store_vector",
        key: vectorKey,
        vector: embedding,
        metadata: {
          contentId,
          contentType,
          dimensions: embedding.length
        }
      }
    }
  );

  if (error) {
    throw error;
  }

  return { s3Key: vectorKey, ...(data as any) };
};

export const encryptSensitiveData = async (dataToEncrypt: unknown) => {
  const { data, error } = await supabase.functions.invoke("vault-wrapper", {
    body: {
      operation: "encrypt",
      data: JSON.stringify(dataToEncrypt),
      purpose: "rag_embeddings"
    }
  });

  if (error) {
    throw error;
  }

  return data;
};

export const listCronJobs = async () => {
  const { data, error } = await supabase.functions.invoke("cron-wrapper", {
    body: { operation: "list_jobs" }
  });

  if (error) {
    throw error;
  }

  return data;
};

export const createCronJob = async (job: {
  name: string;
  schedule: string;
  description?: string;
  enabled?: boolean;
}) => {
  const { data, error } = await supabase.functions.invoke("cron-wrapper", {
    body: { operation: "create_job", ...job }
  });

  if (error) {
    throw error;
  }

  return data;
};

export const hashCode = (input: string): string => {
  let hash = 0;

  for (let i = 0; i < input.length; i += 1) {
    const chr = input.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }

  return String(hash);
};