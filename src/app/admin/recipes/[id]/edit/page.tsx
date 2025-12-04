"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { recipeSchema, RecipeFormValues } from "@/types/forms";
import { uploadRecipeImage } from "@/lib/storage";
import { generateSlug } from "@/lib/slug";
import { triggerEmbedding } from "@/lib/embeddings";
import { TagInput } from "@/components/ui/TagInput";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

const fetchRecipeById = async (id: string) => {
  const { data, error } = await supabase
    .from("recipes")
    .select(
      "id, slug, title, description, image_url, prep_time_min, cook_time_min, servings, difficulty, category, cuisine, tags, status, publish_at, ingredients_text, instructions_detailed, chef_tips, cultural_history, techniques, source_info, difficulty_detailed, nutritional_notes, meta_title, meta_description, canonical_url, og_image_url"
    )
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return data;
};

const AdminEditRecipePage = () => {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string | undefined;

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<RecipeFormValues>({
    resolver: zodResolver(recipeSchema),
    defaultValues: {
      title: "",
      slug: "",
      description: "",
      image_url: "",
      prep_time_min: 0,
      cook_time_min: 0,
      servings: 1,
      difficulty: "beginner",
      category: "",
      cuisine: "",
      tags: [],
      status: "draft",
      publish_at: "",
      ingredients_text: "",
      instructions_detailed: "",
      chef_tips: "",
      cultural_history: "",
      techniques: "",
      source_info: "",
      difficulty_detailed: "",
      nutritional_notes: "",
      meta_title: "",
      meta_description: "",
      canonical_url: "",
      og_image_url: ""
    }
  });

  const {
    data: recipe,
    isLoading,
    isError
  } = useQuery({
    queryKey: ["admin-recipe", id],
    queryFn: () => fetchRecipeById(id as string),
    enabled: !!id
  });

  useEffect(() => {
    if (recipe) {
      reset({
        title: recipe.title ?? "",
        slug: recipe.slug ?? "",
        description: recipe.description ?? "",
        image_url: recipe.image_url ?? "",
        prep_time_min: recipe.prep_time_min ?? 0,
        cook_time_min: recipe.cook_time_min ?? 0,
        servings: recipe.servings ?? 1,
        difficulty: recipe.difficulty ?? "beginner",
        category: recipe.category ?? "",
        cuisine: recipe.cuisine ?? "",
        tags: (recipe.tags as string[]) ?? [],
        status: recipe.status ?? "draft",
        publish_at: recipe.publish_at
          ? new Date(recipe.publish_at).toISOString().slice(0, 16)
          : "",
        ingredients_text: recipe.ingredients_text ?? "",
        instructions_detailed: recipe.instructions_detailed ?? "",
        chef_tips: recipe.chef_tips ?? "",
        cultural_history: recipe.cultural_history ?? "",
        techniques: recipe.techniques ?? "",
        source_info: recipe.source_info ?? "",
        difficulty_detailed: recipe.difficulty_detailed ?? "",
        nutritional_notes: recipe.nutritional_notes ?? "",
        meta_title: recipe.meta_title ?? "",
        meta_description: recipe.meta_description ?? "",
        canonical_url: recipe.canonical_url ?? "",
        og_image_url: recipe.og_image_url ?? ""
      });
    }
  }, [recipe, reset]);

  const onSubmit = async (values: RecipeFormValues) => {
    if (!id) return;

    setMessage(null);
    setErrorMessage(null);

    try {
      let imageUrlToSave: string | null = values.image_url || null;

      if (imageFile) {
        const uploadedUrl = await uploadRecipeImage(imageFile, values.title);
        imageUrlToSave = uploadedUrl;
      }

      if (!imageUrlToSave) {
        throw new Error(
          "Merci d’ajouter une image (via URL ou upload) pour cette recette."
        );
      }

      const slug =
        (values.slug && values.slug.trim()) || generateSlug(values.title);

      let publishAtIso: string | null = null;
      if (values.publish_at) {
        const d = new Date(values.publish_at);
        if (!Number.isNaN(d.getTime())) {
          publishAtIso = d.toISOString();
        }
      }

      const payload = {
        slug,
        title: values.title,
        description: values.description,
        image_url: imageUrlToSave,
        prep_time_min: values.prep_time_min,
        cook_time_min: values.cook_time_min,
        servings: values.servings,
        difficulty: values.difficulty,
        category: values.category,
        cuisine: values.cuisine,
        tags: values.tags,
        status: values.status,
        publish_at: publishAtIso,
        ingredients_text: values.ingredients_text,
        instructions_detailed: values.instructions_detailed,
        chef_tips: values.chef_tips || null,
        cultural_history: values.cultural_history || null,
        techniques: values.techniques || null,
        source_info: values.source_info || null,
        difficulty_detailed: values.difficulty_detailed || null,
        nutritional_notes: values.nutritional_notes || null,
        meta_title: values.meta_title || null,
        meta_description: values.meta_description || null,
        canonical_url: values.canonical_url || null,
        og_image_url: values.og_image_url || null
      };

      const { error } = await supabase
        .from("recipes")
        .update(payload)
        .eq("id", id);

      if (error) {
        throw error;
      }

      setMessage(
        "Recette mise à jour. Pensez à recalculer l’embedding si le contenu a beaucoup changé."
      );
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error(err);
      setErrorMessage(
        err?.message ?? "Erreur lors de la mise à jour de la recette."
      );
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    // eslint-disable-next-line no-alert
    const confirmDelete = window.confirm(
      "Voulez-vous vraiment supprimer cette recette ? Cette action est irréversible."
    );
    if (!confirmDelete) return;

    try {
      const { error } = await supabase.from("recipes").delete().eq("id", id);
      if (error) {
        throw error;
      }
      router.push("/admin/recipes");
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error(err);
      setErrorMessage(
        err?.message ?? "Erreur lors de la suppression de la recette."
      );
    }
  };

  const handleDuplicate = async () => {
    if (!recipe) return;

    setMessage(null);
    setErrorMessage(null);

    try {
      const baseSlug = recipe.slug || generateSlug(recipe.title);
      const newSlug = `${baseSlug}-variante`;

      const payload = {
        ...recipe,
        id: undefined,
        slug: newSlug,
        status: "draft",
        publish_at: null
      };

      const { data: inserted, error } = await supabase
        .from("recipes")
        .insert([payload])
        .select()
        .single();

      if (error) {
        throw error;
      }

      await triggerEmbedding("recipe", inserted.id as string);

      setMessage("Variante créée et embedding déclenché.");
      router.push(`/admin/recipes/${inserted.id}/edit`);
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error(err);
      setErrorMessage(
        err?.message ?? "Erreur lors de la duplication de la recette."
      );
    }
  };

  const handleRecomputeEmbedding = async () => {
    if (!id) return;
    setErrorMessage(null);
    setMessage(null);

    try {
      await triggerEmbedding("recipe", id);
      setMessage("Embedding déclenché pour cette recette.");
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error(err);
      setErrorMessage(
        err?.message ?? "Erreur lors du déclenchement de l’embedding."
      );
    }
  };

  const isPremium = useMemo(() => {
    if (!recipe) return false;
    return (
      !!recipe.nutritional_notes &&
      !!recipe.cultural_history &&
      !!recipe.techniques
    );
  }, [recipe]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner className="mr-2" />
        <span className="text-sm text-slate-400">
          Chargement de la recette…
        </span>
      </div>
    );
  }

  if (isError || !recipe) {
    return (
      <p className="text-sm text-red-300">
        Impossible de charger la recette demandée.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">
            Édition recette – Mode premium
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Organisez les informations de base, les ingrédients, les étapes
            enrichies et le SEO de cette recette.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Qualité actuelle :{" "}
            {isPremium ? (
              <span className="font-semibold text-emerald-300">
                premium (heuristique)
              </span>
            ) : (
              <span className="font-semibold text-amber-300">
                à enrichir
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            className="text-xs"
            onClick={handleDuplicate}
          >
            Dupliquer la recette
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="text-xs"
            onClick={handleRecomputeEmbedding}
          >
            Générer embedding
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="text-xs"
            onClick={() => router.push("/admin/recipes")}
          >
            Retour à la liste
          </Button>
        </div>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="card space-y-6 px-5 py-5"
      >
        {/* Onglet 1 : Infos de base */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-100">
            1. Infos de base
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="title">Titre</label>
              <input
                id="title"
                type="text"
                className="mt-1 w-full"
                placeholder="Tarte aux pommes croustillante"
                {...register("title")}
              />
              {errors.title && (
                <p className="form-error">{errors.title.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="slug">Slug</label>
              <input
                id="slug"
                type="text"
                className="mt-1 w-full"
                placeholder="tarte-aux-pommes-croustillante"
                {...register("slug")}
              />
              <p className="mt-1 text-xs text-slate-500">
                Laissez vide pour le régénérer automatiquement à partir du
                titre.
              </p>
            </div>

            <div>
              <label htmlFor="category">Catégorie</label>
              <input
                id="category"
                type="text"
                className="mt-1 w-full"
                placeholder="dessert, plat principal…"
                {...register("category")}
              />
              {errors.category && (
                <p className="form-error">{errors.category.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="cuisine">Cuisine</label>
              <input
                id="cuisine"
                type="text"
                className="mt-1 w-full"
                placeholder="française, italienne, japonaise…"
                {...register("cuisine")}
              />
              {errors.cuisine && (
                <p className="form-error">{errors.cuisine.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label htmlFor="description">Description courte</label>
              <textarea
                id="description"
                rows={3}
                className="mt-1 w-full"
                placeholder="Brève description éditoriale de la recette…"
                {...register("description")}
              />
              {errors.description && (
                <p className="form-error">{errors.description.message}</p>
              )}
            </div>
          </div>
        </section>

        {/* Onglet 2 : Durée, portions, statut */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-100">
            2. Durée, portions &amp; statut
          </h2>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label htmlFor="prep_time_min">Préparation (min)</label>
              <input
                id="prep_time_min"
                type="number"
                className="mt-1 w-full"
                min={0}
                {...register("prep_time_min", { valueAsNumber: true })}
              />
              {errors.prep_time_min && (
                <p className="form-error">{errors.prep_time_min.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="cook_time_min">Cuisson (min)</label>
              <input
                id="cook_time_min"
                type="number"
                className="mt-1 w-full"
                min={0}
                {...register("cook_time_min", { valueAsNumber: true })}
              />
              {errors.cook_time_min && (
                <p className="form-error">{errors.cook_time_min.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="servings">Portions</label>
              <input
                id="servings"
                type="number"
                className="mt-1 w-full"
                min={1}
                {...register("servings", { valueAsNumber: true })}
              />
              {errors.servings && (
                <p className="form-error">{errors.servings.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="difficulty">Difficulté</label>
              <select
                id="difficulty"
                className="mt-1 w-full"
                {...register("difficulty")}
              >
                <option value="beginner">Débutant</option>
                <option value="intermediate">Intermédiaire</option>
                <option value="advanced">Avancé</option>
              </select>
              {errors.difficulty && (
                <p className="form-error">{errors.difficulty.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="status">Statut</label>
              <select
                id="status"
                className="mt-1 w-full"
                {...register("status")}
              >
                <option value="draft">Brouillon</option>
                <option value="scheduled">Programmé</option>
                <option value="published">Publié</option>
              </select>
              {errors.status && (
                <p className="form-error">{errors.status.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="publish_at">Publication programmée</label>
              <input
                id="publish_at"
                type="datetime-local"
                className="mt-1 w-full"
                {...register("publish_at")}
              />
              <p className="mt-1 text-xs text-slate-500">
                Utilisé si le statut est{" "}
                <span className="font-semibold">programmé</span>.
              </p>
            </div>

            <div className="md:col-span-2">
              <label>Tags</label>
              <Controller
                control={control}
                name="tags"
                render={({ field }) => (
                  <TagInput
                    value={field.value ?? []}
                    onChange={field.onChange}
                    placeholder="rapide, végétarien, sans gluten…"
                  />
                )}
              />
              {errors.tags && (
                <p className="form-error">{errors.tags.message as string}</p>
              )}
            </div>
          </div>
        </section>

        {/* Onglet 3 : Texte détaillé & enrichissement */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-100">
            3. Texte détaillé &amp; enrichissement
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="ingredients_text">
                Ingrédients (une ligne par ingrédient)
              </label>
              <textarea
                id="ingredients_text"
                rows={6}
                className="mt-1 w-full font-mono text-xs"
                placeholder={"200 g farine\n100 g beurre\n3 pommes…"}
                {...register("ingredients_text")}
              />
              {errors.ingredients_text && (
                <p className="form-error">
                  {errors.ingredients_text.message}
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <label htmlFor="instructions_detailed">
                Instructions détaillées
              </label>
              <textarea
                id="instructions_detailed"
                rows={8}
                className="mt-1 w-full"
                placeholder="Détaillez les étapes complètes de la recette…"
                {...register("instructions_detailed")}
              />
              {errors.instructions_detailed && (
                <p className="form-error">
                  {errors.instructions_detailed.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="chef_tips">Astuces Chefito</label>
              <textarea
                id="chef_tips"
                rows={4}
                className="mt-1 w-full"
                placeholder="Conseils pratiques, astuces de cuisson…"
                {...register("chef_tips")}
              />
            </div>

            <div>
              <label htmlFor="cultural_history">
                Histoire / contexte culturel
              </label>
              <textarea
                id="cultural_history"
                rows={4}
                className="mt-1 w-full"
                placeholder="Origine de la recette, contexte culturel…"
                {...register("cultural_history")}
              />
            </div>

            <div>
              <label htmlFor="techniques">Techniques mises en avant</label>
              <textarea
                id="techniques"
                rows={4}
                className="mt-1 w-full"
                placeholder="Techniques de cuisine importantes…"
                {...register("techniques")}
              />
            </div>

            <div>
              <label htmlFor="source_info">Source / crédits</label>
              <textarea
                id="source_info"
                rows={4}
                className="mt-1 w-full"
                placeholder="Livre, chef, blog, inspiration…"
                {...register("source_info")}
              />
            </div>

            <div>
              <label htmlFor="difficulty_detailed">
                Détails sur la difficulté
              </label>
              <textarea
                id="difficulty_detailed"
                rows={4}
                className="mt-1 w-full"
                placeholder="Pièges, points critiques, erreurs fréquentes…"
                {...register("difficulty_detailed")}
              />
            </div>

            <div>
              <label htmlFor="nutritional_notes">Notes nutritionnelles</label>
              <textarea
                id="nutritional_notes"
                rows={4}
                className="mt-1 w-full"
                placeholder="Informations nutritionnelles, recommandations…"
                {...register("nutritional_notes")}
              />
            </div>
          </div>
        </section>

        {/* Onglet 4 : Image & SEO */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-100">
            4. Image &amp; SEO
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="image_url">Image URL</label>
              <input
                id="image_url"
                type="url"
                className="mt-1 w-full"
                placeholder="https://…"
                {...register("image_url")}
              />
              {errors.image_url && (
                <p className="form-error">{errors.image_url.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="image_file">Image (upload)</label>
              <input
                id="image_file"
                type="file"
                accept="image/*"
                className="mt-1 w-full text-sm text-slate-200 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-100 hover:file:bg-slate-700"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setImageFile(file);
                }}
              />
              <p className="mt-1 text-xs text-slate-500">
                Vous pouvez fournir une URL ou uploader un fichier. En cas
                d&apos;upload, le fichier est stocké dans Supabase Storage.
              </p>
            </div>

            <div>
              <label htmlFor="meta_title">Titre SEO</label>
              <input
                id="meta_title"
                type="text"
                className="mt-1 w-full"
                placeholder="Titre optimisé pour Google"
                {...register("meta_title")}
              />
            </div>

            <div>
              <label htmlFor="meta_description">Description Meta</label>
              <textarea
                id="meta_description"
                rows={3}
                className="mt-1 w-full"
                placeholder="Description pour les résultats Google"
                {...register("meta_description")}
              />
            </div>

            <div>
              <label htmlFor="canonical_url">URL canonique</label>
              <input
                id="canonical_url"
                type="url"
                className="mt-1 w-full"
                placeholder="https://monsite.com/recettes/..."
                {...register("canonical_url")}
              />
              {errors.canonical_url && (
                <p className="form-error">
                  {errors.canonical_url.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="og_image_url">Image Open Graph</label>
              <input
                id="og_image_url"
                type="url"
                className="mt-1 w-full"
                placeholder="https://monsite.com/images/recette.jpg"
                {...register("og_image_url")}
              />
              {errors.og_image_url && (
                <p className="form-error">{errors.og_image_url.message}</p>
              )}
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2"
            >
              {isSubmitting && (
                <LoadingSpinner size="sm" className="text-slate-100" />
              )}
              <span>Mettre à jour la recette</span>
            </Button>

            <Button
              type="button"
              variant="secondary"
              className="inline-flex items-center gap-2 text-xs text-red-300 hover:text-red-200"
              onClick={handleDelete}
            >
              Supprimer
            </Button>
          </div>

          <div className="flex flex-col items-end gap-1 text-xs">
            {message && <p className="text-emerald-300">{message}</p>}
            {errorMessage && <p className="text-red-300">{errorMessage}</p>}
          </div>
        </div>
      </form>
    </div>
  );
};

export default AdminEditRecipePage;