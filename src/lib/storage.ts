import { supabase } from "./supabaseClient";
import { generateSlug } from "./slug";

const RECIPE_IMAGES_BUCKET = "recipe-images";

/**
 * Uploads a recipe image to Supabase Storage and returns its public URL.
 * The file is stored under: recipes/<slug>/<slug>-<timestamp>.<ext>
 */
export const uploadRecipeImage = async (
  file: File,
  recipeTitle: string
): Promise<string> => {
  const slug = generateSlug(recipeTitle || "recette");
  const extension =
    file.name.split(".").length > 1 ? file.name.split(".").pop() : "jpg";
  const timestamp = Date.now();
  const path = `recipes/${slug}/${slug}-${timestamp}.${extension}`;

  const { data, error } = await supabase.storage
    .from(RECIPE_IMAGES_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false
    });

  if (error) {
    throw error;
  }

  const publicUrlData = supabase.storage
    .from(RECIPE_IMAGES_BUCKET)
    .getPublicUrl(data.path);

  return publicUrlData.data.publicUrl;
};