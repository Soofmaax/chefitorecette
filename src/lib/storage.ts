import { supabase } from "./supabaseClient";
import { generateSlug } from "./slug";

const RECIPE_IMAGES_BUCKET = "recipe-images";
const AUDIO_FILES_BUCKET = "audio-files";

const MAX_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 Mo
const MAX_AUDIO_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 Mo

/**
 * Uploads a recipe image to Supabase Storage and returns its public URL.
 * The file is stored under: recipes/&lt;slug>/&lt;slug&gt;-&lt;timestamp&gt;.&lt;ext&gt;
 */
export const uploadRecipeImage = async (
  file: File,
  recipeTitle: string
): Promise<string> => {
  if (!file.type.startsWith("image/")) {
    throw new Error("Le fichier sélectionné n'est pas une image valide.");
  }

  if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
    throw new Error("L'image dépasse la taille maximale autorisée (5 Mo).");
  }

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
 * The file is stored under: audio/&lt;audioKey>/&lt;audioKey&gt;-&lt;timestamp&gt;.&lt;ext&gt;
 */
export const uploadAudioFile = async (
  file: File,
  audioKey: string
): Promise<string> => {
  if (!file.type.startsWith("audio/")) {
    throw new Error("Le fichier sélectionné n'est pas un fichier audio valide.");
  }

  if (file.size > MAX_AUDIO_FILE_SIZE_BYTES) {
    throw new Error("Le fichier audio dépasse la taille maximale autorisée (20 Mo).");
  }

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