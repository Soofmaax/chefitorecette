import { supabase } from "./supabaseClient";

export const triggerEmbedding = async (type: "recipe" | "post", id: string) => {
  const functionName =
    type === "recipe"
      ? "generate-recipe-embedding"
      : "generate-post-embedding";

  const { data, error } = await supabase.functions.invoke(functionName, {
    body: { [`${type}_id`]: id }
  });

  if (error) {
    throw error;
  }

  return data;
};