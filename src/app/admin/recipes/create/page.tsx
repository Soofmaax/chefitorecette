"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { recipeSchema, RecipeFormValues } from "@/types/forms";
import { difficultyTemplates } from "@/lib/recipesDifficulty";
import { uploadRecipeImage } from "@/lib/storage";
import { generateSlug } from "@/lib/slug";
import { TagInput } from "@/components/ui/TagInput";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

const RECIPE_CATEGORY_OPTIONS = [
  { value: "entree", label: "Entrée" },
  { value: "plat_principal", label: "Plat principal" },
  { value: "accompagnement", label: "Accompagnement" },
  { value: "dessert", label: "Dessert" },
  { value: "aperitif", label: "Apéritif" },
  { value: "gateau", label: "Gâteau" },
  { value: "boisson", label: "Boisson" },
  { value: "sauce", label: "Sauce" },
  { value: "test", label: "Test" }
] as const;

const CATEGORY_LABEL_TO_KEY: Record<string, string> = {
  Entrée: "entree",
  Entree: "entree",
  entree: "entree",
  "Plat principal": "plat_principal",
  "plat principal": "plat_principal",
  plat_principal: "plat_principal",
  Accompagnement: "accompagnement",
  accompagnement: "accompagnement",
  Dessert: "dessert",
  dessert: "dessert",
  "Apéritif": "aperitif",
  Aperitif: "aperitif",
  aperitif: "aperitif",
  "Gâteau": "gateau",
  Gateau: "gateau",
  gateau: "gateau",
  Boisson: "boisson",
  boisson: "boisson",
  Sauce: "sauce",
  sauce: "sauce",
  Test: "test",
  test: "test"
};

const fetchRecipeCuisines = async (): Promise<string[]> => {
  const { data, error } = await supabase.from("recipes").select("cuisine");

  if (error) {
    throw error;
  }

  const rows = (data as { cuisine: string | null }[]) ?? [];
  const values = rows
    .map((r) => r.cuisine)
    .filter((c): c is string => !!c && c.trim() !== "");

  return Array.from(new Set(values)).sort();
};

const fetchEditorialRow = async (id: string) => {
  const { data, error } = await supabase
    .from("editorial_calendar")
    .select(
      "id, title, category, difficulty, target_month, status, priority, tags, chefito_angle"
    )
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return data;
};

const isNonEmpty = (value: string | null | undefined) =>
  typeof value === "string" && value.trim() !== "";

const SERVING_TEMPERATURE_OPTIONS = [
  { value: "chaud", label: "Chaude" },
  { value: "tiede", label: "Tiède" },
  { value: "ambiante", label: "Température ambiante" },
  { value: "froid", label: "Froide" },
  { value: "au_choix", label: "Au choix" }
] as const;

const STORAGE_MODE_OPTIONS = [
  { value: "refrigerateur", label: "Réfrigérateur" },
  { value: "congelateur", label: "Congélateur" },
  { value: "ambiante", label: "Ambiante" },
  { value: "sous_vide", label: "Sous vide" },
  { value: "boite_hermetique", label: "Boîte hermétique" },
  { value: "au_choix", label: "Au choix" }
] as const;

const DIETARY_LABEL_OPTIONS = [
  { value: "vegetarien", label: "Végétarien" },
  { value: "vegetalien", label: "Végétalien" },
  { value: "vegan", label: "Vegan" },
  { value: "pescetarien", label: "Pescétarien" },
  { value: "sans_gluten", label: "Sans gluten" },
  { value: "sans_lactose", label: "Sans lactose" },
  { value: "sans_oeuf", label: "Sans œuf" },
  { value: "sans_arachide", label: "Sans arachide" },
  { value: "sans_fruits_a_coque", label: "Sans fruits à coque" },
  { value: "sans_soja", label: "Sans soja" },
  { value: "sans_sucre_ajoute", label: "Sans sucre ajouté" },
  { value: "sans_sel_ajoute", label: "Sans sel ajouté" },
  { value: "halal", label: "Halal" },
  { value: "casher", label: "Casher" }
];

const AdminCreateRecipePage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editorialId = searchParams?.get("editorialId") ?? null;

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
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
      rest_time_min: 0,
      servings: 1,
      difficulty: "beginner",
      category: "plat_principal",
      cuisine: "",
      tags: [],
      dietary_labels: [],
      serving_temperatures: [],
      storage_modes: [],
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
      storage_instructions: "",
      storage_duration_days: undefined,
      meta_title: "",
      meta_description: "",
      canonical_url: "",
      og_image_url: "",
      schema_jsonld_enabled: false
    }
  });

  const { data: allCuisines = [] } = useQuery({
    queryKey: ["recipes-cuisines-all"],
    queryFn: fetchRecipeCuisines
  });

  const { data: editorialRow } = useQuery({
    queryKey: ["editorial-row", editorialId],
    queryFn: () => fetchEditorialRow(editorialId as string),
    enabled: !!editorialId
  });

  useEffect(() => {
    if (editorialRow) {
      reset({
        title: editorialRow.title ?? "",
        slug: "",
        description:
          (editorialRow.chefito_angle as string) ??
          "",
        image_url: "",
        prep_time_min: 0,
        cook_time_min: 0,
        rest_time_min: 0,
        servings: 1,
        difficulty:
          (editorialRow.difficulty as RecipeFormValues["difficulty"]) ??
          "beginner",
        category:
          (editorialRow.category &&
            CATEGORY_LABEL_TO_KEY[editorialRow.category]) ||
          "plat_principal",
        cuisine: "",
        tags: (editorialRow.tags as string[]) ?? [],
        dietary_labels: [],
        serving_temperatures: [],
        storage_modes: [],
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
        storage_instructions: "",
        storage_duration_days: undefined,
        meta_title: "",
        meta_description: "",
        canonical_url: "",
        og_image_url: "",
        schema_jsonld_enabled: false
      });
    }
  }, [editorialRow, reset]);

  const watchedTitle = watch("title");
  const watchedDescription = watch("description");
  const watchedSlug = watch("slug");
  const watchedImageUrl = watch("image_url");
  const watchedMetaTitle = watch("meta_title");
  const watchedMetaDescription = watch("meta_description");
  const watchedCanonicalUrl = watch("canonical_url");
  const watchedOgImageUrl = watch("og_image_url");
  const watchedDifficulty = watch("difficulty");
  const watchedDifficultyDetailed = watch("difficulty_detailed");

  useEffect(() => {
    if (watchedTitle && !isNonEmpty(watchedMetaTitle)) {
      setValue("meta_title", `Recette de ${watchedTitle}`, {
        shouldDirty: true
      });
    }
  }, [watchedTitle, watchedMetaTitle, setValue]);

  useEffect(() => {
    if (watchedDescription && !isNonEmpty(watchedMetaDescription)) {
      const base = watchedDescription.trim();
      const truncated =
        base.length > 160 ? `${base.slice(0, 157).trimEnd()}…` : base;
      if (truncated) {
        setValue("meta_description", truncated, {
          shouldDirty: true
        });
      }
    }
  }, [watchedDescription, watchedMetaDescription, setValue]);

  useEffect(() => {
    if (watchedSlug && !isNonEmpty(watchedCanonicalUrl)) {
      setValue("canonical_url", `/recettes/${watchedSlug}`, {
        shouldDirty: true
      });
    }
  }, [watchedSlug, watchedCanonicalUrl, setValue]);

  useEffect(() => {
    if (watchedImageUrl && !isNonEmpty(watchedOgImageUrl)) {
      setValue("og_image_url", watchedImageUrl, {
        shouldDirty: true
      });
    }
  }, [watchedImageUrl, watchedOgImageUrl, setValue]);

  useEffect(() => {
    if (!watchedDifficulty) return;
    if (isNonEmpty(watchedDifficultyDetailed)) return;
    const template = difficultyTemplates[watchedDifficulty];
    if (template) {
      setValue("difficulty_detailed", template, {
        shouldDirty: true
      });
    }
  }, [watchedDifficulty, watchedDifficultyDetailed, setValue]);

  const onSubmit = async (values: RecipeFormValues) => {
    setMessage(null);
    setErrorMessage(null);

    try {
      let imageUrlToSave: string | null = values.image_url || null;

      if (imageFile) {
        const uploadedUrl = await uploadRecipeImage(imageFile, values.title);
        imageUrlToSave = uploadedUrl;
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
        rest_time_min: values.rest_time_min,
        servings: values.servings,
        difficulty: values.difficulty,
        category: values.category,
        cuisine: values.cuisine,
        tags: values.tags,
        dietary_labels:
          values.dietary_labels && values.dietary_labels.length > 0
            ? values.dietary_labels
            : null,
        serving_temperatures:
          values.serving_temperatures &&
          values.serving_temperatures.length > 0
            ? values.serving_temperatures
            : null,
        storage_modes:
          values.storage_modes && values.storage_modes.length > 0
            ? values.storage_modes
            : null,
        status: "draft",
        publish_at: publishAtIso,
        ingredients_text: values.ingredients_text,
        instructions_detailed: values.instructions_detailed,
        chef_tips: values.chef_tips || null,
        cultural_history: values.cultural_history || null,
        techniques: values.techniques || null,
        source_info: values.source_info || null,
        difficulty_detailed: values.difficulty_detailed || null,
        nutritional_notes: values.nutritional_notes || null,
        storage_instructions: values.storage_instructions || null,
        storage_duration_days:
          typeof values.storage_duration_days === "number"
            ? values.storage_duration_days
            : null,
        serving_temperature: null,
        meta_title: values.meta_title || null,
        meta_description: values.meta_description || null,
        canonical_url: values.canonical_url || null,
        og_image_url: values.og_image_url || null,
        schema_jsonld_enabled: values.schema_jsonld_enabled ?? false
      };

      const { data: inserted, error } = await supabase
        .from("recipes")
        .insert([payload])
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (editorialId && inserted?.id) {
        await supabase
          .from("editorial_calendar")
          .update({
            recipe_id: inserted.id,
            status: "draft"
          })
          .eq("id", editorialId);
      }

      setMessage(
        "Recette créée. Vous pouvez maintenant l'enrichir et la compléter dans l'éditeur détaillé."
      );
      router.push(`/admin/recipes/${inserted.id}/edit`);
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error(err);
      setErrorMessage(
        err?.message ?? "Erreur lors de la création de la recette."
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">
            Nouvelle recette – depuis le calendrier éditorial
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Crée une fiche recette brouillon à partir d&apos;une ligne du
            calendrier éditorial, puis continue son enrichissement dans
            l&apos;éditeur détaillé.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            className="text-xs"
            onClick={() => router.push("/admin/recipes")}
          >
            Retour à la liste des recettes
          </Button>
        </div>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="card space-y-6 px-5 py-5"
      >
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
              <label htmlFor="category">Type de plat</label>
              <select
                id="category"
                className="mt-1 w-full"
                {...register("category")}
              >
                {RECIPE_CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="form-error">{errors.category.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="cuisine">Cuisine</label>
              <input
                id="cuisine"
                type="text"
                list="recipe-cuisines-options"
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
          <datalist id="recipe-cuisines-options">
            {allCuisines.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-100">
            2. Durée, portions
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
              <label htmlFor="rest_time_min">Repos (min)</label>
              <input
                id="rest_time_min"
                type="number"
                className="mt-1 w-full"
                min={0}
                {...register("rest_time_min", { valueAsNumber: true })}
              />
              {errors.rest_time_min && (
                <p className="form-error">{errors.rest_time_min.message}</p>
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

            <div className="md:col-span-4">
              <label>Régimes / contraintes alimentaires</label>
              <p className="mt-1 text-xs text-slate-500">
                Sélectionne les régimes compatibles avec cette recette. Ces
                valeurs sont contrôlées au niveau de la base (liste fermée).
              </p>
              <Controller
                control={control}
                name="dietary_labels"
                render={({ field }) => {
                  const selected: string[] = field.value ?? [];
                  const toggle = (val: string) => {
                    if (selected.includes(val)) {
                      field.onChange(selected.filter((v) => v !== val));
                    } else {
                      field.onChange([...selected, val]);
                    }
                  };
                  return (
                    <div className="mt-2 flex flex-wrap gap-3">
                      {DIETARY_LABEL_OPTIONS.map((opt) => (
                        <label
                          key={opt.value}
                          className="inline-flex items-center gap-2 text-xs text-slate-200"
                        >
                          <input
                            type="checkbox"
                            className="h-3 w-3 accent-primary-500"
                            checked={selected.includes(opt.value)}
                            onChange={() => toggle(opt.value)}
                          />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  );
                }}
              />
              {errors.dietary_labels && (
                <p className="form-error">
                  {errors.dietary_labels.message as string}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* 3. Repos & conservation */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-100">
            3. Repos &amp; conservation
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label htmlFor="storage_duration_days">
                Durée de conservation (jours)
              </label>
              <input
                id="storage_duration_days"
                type="number"
                className="mt-1 w-full"
                min={0}
                {...register("storage_duration_days", {
                  valueAsNumber: true
                })}
              />
              {errors.storage_duration_days && (
                <p className="form-error">
                  {errors.storage_duration_days.message}
                </p>
              )}
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-200">
                Température de service
              </p>
              <Controller
                control={control}
                name="serving_temperatures"
                render={({ field }) => {
                  const selected: string[] = field.value ?? [];
                  const toggle = (val: string) => {
                    if (selected.includes(val)) {
                      field.onChange(selected.filter((v) => v !== val));
                    } else {
                      field.onChange([...selected, val]);
                    }
                  };
                  return (
                    <div className="mt-1 flex flex-wrap gap-3 text-xs">
                      {SERVING_TEMPERATURE_OPTIONS.map((opt) => (
                        <label
                          key={opt.value}
                          className="inline-flex items-center gap-2 text-slate-200"
                        >
                          <input
                            type="checkbox"
                            className="h-3 w-3 accent-primary-500"
                            checked={selected.includes(opt.value)}
                            onChange={() => toggle(opt.value)}
                          />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  );
                }}
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-200">
                Modes de conservation
              </p>
              <Controller
                control={control}
                name="storage_modes"
                render={({ field }) => {
                  const selected: string[] = field.value ?? [];
                  const toggle = (val: string) => {
                    if (selected.includes(val)) {
                      field.onChange(selected.filter((v) => v !== val));
                    } else {
                      field.onChange([...selected, val]);
                    }
                  };
                  return (
                    <div className="mt-1 flex flex-wrap gap-3 text-xs">
                      {STORAGE_MODE_OPTIONS.map((opt) => (
                        <label
                          key={opt.value}
                          className="inline-flex items-center gap-2 text-slate-200"
                        >
                          <input
                            type="checkbox"
                            className="h-3 w-3 accent-primary-500"
                            checked={selected.includes(opt.value)}
                            onChange={() => toggle(opt.value)}
                          />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  );
                }}
              />
            </div>
            <div className="md:col-span-3">
              <label htmlFor="storage_instructions">
                Conseils de conservation
              </label>
              <textarea
                id="storage_instructions"
                rows={3}
                className="mt-1 w-full"
                placeholder="Par exemple : se conserve 2 jours au réfrigérateur dans un contenant hermétique…"
                {...register("storage_instructions")}
              />
            </div>
          </div>
        </section>

        {/* 4. Texte détaillé */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-100">
            4. Texte détaillé
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
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-100">
            5. Image &amp; SEO
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
                Vous pouvez fournir une URL ou uploader un fichier (max 5 Mo).
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
              <span>Créer la recette</span>
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

export default AdminCreateRecipePage;