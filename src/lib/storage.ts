import { supabase } from "./supabaseClient";
import { generateSlug } from "./slug";

const RECIPE_IMAGES_BUCKET = "recipe-images";

/**
 * Uploads a recipe image to Supabase Storage and returns its public URL.
 * The file is stored under: recipes/&lt;slug&gt;/&lt;slug&gt;-&lt;timestamp&gt;.&lt;ext&gt;
 */
export const uploadRecipeImage = async (
  file: File,
  recipeTitle: string
): Promise<string> =&gt; {
  const slug = generateSlug(recipeTitle || "recette");
  const extension =
    file.name.split(".").length &gt; 1 ? file.name.split(".").pop() : "jpg";
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