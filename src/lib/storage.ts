import { supabase } from "./supabaseClient";
import { generateSlug } from "./slug";

const RECIPE_IMAGES_BUCKET = "recipe-images";
const AUDIO_FILES_BUCKET = "audio-files";

/**
 * Uploads a recipe image to Supabase Storage and returns its public URL.
 * The file is stored under: recipes/&lt;slug>/&lt;slug>-&lt;timestamp>.&lt;ext>
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

/**
 * Uploads an audio file to Supabase Storage and returns its public URL.
 * The file is stored under: audio/&lt;audioKey>/&lt;audioKey>-&lt;timestamp>.&lt;ext>
 */
export const uploadAudioFile = async (
  file: File,
  audioKey: string
): Promise<string> => {
  const safeKey = generateSlug(audioKey || "audio");
  const extension =
    file.name.split(".").length > 1 ? file.name.split(".").pop() : "mp3";
  const timestamp = Date.now();
  const path = `audio/${safeKey}/${safeKey}-${timestamp}.${extension}`;

  const { data, error } = await supabase.storage
    .from(AUDIO_FILES_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false
    });

  if (error) {
    throw error;
  }

  const publicUrlData = supabase.storage
    .from(AUDIO_FILES_BUCKET)
    .getPublicUrl(data.path);

  return publicUrlData.data.publicUrl;
};