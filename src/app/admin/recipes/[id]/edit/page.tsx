"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/lib/supabaseClient";
import { uploadRecipeImage } from "@/lib/storage";
import { generateSlug } from "@/lib/slug";
import {
  recipeSchema,
  RecipeFormValues
} from "@/types/forms";
import {
  getRecipeMissingFields,
  computePrePublishIssues
} from "@/lib/recipesQuality";
import { difficultyTemplates } from "@/lib/recipesDifficulty";
import { uploadRecipeImage } from "@/lib/storage";
import { generateSlug } from "@/lib/slug";
import { triggerEmbedding } from "@/lib/embeddings";
import { buildRecipeJsonLd, validateRecipeJsonLd } from "@/lib/seo";
import { TagInput } from "@/components/ui/TagInput";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { RecipeIngredientsEditor } from "@/components/admin/RecipeIngredientsEditor";
import { RecipeStepsEditor } from "@/components/admin/RecipeStepsEditor";
import { RecipeConceptsEditor } from "@/components/admin/RecipeConceptsEditor";

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

type Utensil = {
  key: string;
  label: string;
};



const fetchRecipeById = async (id: string) => {
  const { data, error } = await supabase
    .from("recipes")
    .select(
      "id, slug, title, description, image_url, prep_time_min, cook_time_min, rest_time_min, servings, difficulty, category, cuisine, tags, dietary_labels, status, publish_at, ingredients_text, instructions_detailed, chef_tips, cultural_history, techniques, source_info, difficulty_detailed, nutritional_notes, storage_instructions, storage_duration_days, serving_temperatures, storage_modes, serving_temperature, meta_title, meta_description, canonical_url, og_image_url, embedding, schema_jsonld_enabled"
    )
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return data;
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

const isNonEmpty = (value: string | null | undefined) =>
  typeof value === "string" && value.trim() !== "";

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

const getRecipeMissingFields = (recipe: any): string[] => {
  const missing: string[] = [];

  if (recipe.status !== "published") {
    missing.push("Statut publié");
  }

  if (!isNonEmpty(recipe.image_url)) {
    missing.push("Image");
  }

  if (!isNonEmpty(recipe.description)) {
    missing.push("Description");
  }

  if (!isNonEmpty(recipe.ingredients_text)) {
    missing.push("Ingrédients");
  }

  if (!isNonEmpty(recipe.instructions_detailed)) {
    missing.push("Instructions détaillées");
  }

  if (!isNonEmpty(recipe.cultural_history)) {
    missing.push("Histoire / contexte culturel");
  }

  if (!isNonEmpty(recipe.techniques)) {
    missing.push("Techniques");
  }

  if (!isNonEmpty(recipe.nutritional_notes)) {
    missing.push("Notes nutritionnelles");
  }

  if (!isNonEmpty(recipe.meta_title)) {
    missing.push("Titre SEO");
  }

  if (!isNonEmpty(recipe.meta_description)) {
    missing.push("Description SEO");
  }

  if (
    !isNonEmpty(recipe.chef_tips) &&
    !isNonEmpty(recipe.difficulty_detailed)
  ) {
    missing.push("Astuces ou détails difficulté");
  }

  return missing;
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

  const {
    data: recipe,
    isLoading,
    isError
  } = useQuery({
    queryKey: ["admin-recipe", id],
    queryFn: () => fetchRecipeById(id as string),
    enabled: !!id
  });

  const { data: recipeConcepts } = useQuery({
    queryKey: ["recipe-concepts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipe_concepts")
        .select("id, concept_key")
        .eq("recipe_id", id);

      if (error) {
        throw error;
      }

      return (data as { id: string; concept_key: string }[]) ?? [];
    },
    enabled: !!id
  });

  const { data: recipeAudioUsage } = useQuery({
    queryKey: ["recipe-audio-usage", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audio_usage_stats")
        .select("id")
        .eq("recipe_id", id);

      if (error) {
        throw error;
      }

      return (data as { id: string }[]) ?? [];
    },
    enabled: !!id
  });

  const { data: allCuisines = [] } = useQuery({
    queryKey: ["recipes-cuisines-all"],
    queryFn: fetchRecipeCuisines
  });

  const { data: ingredientsCount = 0 } = useQuery({
    queryKey: ["recipe-ingredients-count", id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("recipe_ingredients_normalized")
        .select("id", { count: "exact", head: true })
        .eq("recipe_id", id);

      if (error) {
        throw error;
      }

      return count ?? 0;
    },
    enabled: !!id
  });

  const { data: stepsCount = 0 } = useQuery({
    queryKey: ["recipe-steps-count", id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("recipe_steps_enhanced")
        .select("id", { count: "exact", head: true })
        .eq("recipe_id", id);

      if (error) {
        throw error;
      }

      return count ?? 0;
    },
    enabled: !!id
  });

  const { data: utensilsCatalog = [] } = useQuery({
    queryKey: ["utensils-catalog"],
    queryFn: async (): Promise<Utensil[]> => {
      const { data, error } = await supabase
        .from("utensils_catalog")
        .select("key, label")
        .order("label", { ascending: true });

      if (error) {
        throw error;
      }

      return (data as Utensil[]) ?? [];
    }
  });

  const { data: recipeUtensils = [] } = useQuery({
    queryKey: ["recipe-utensils", id],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("recipe_utensils")
        .select("utensil_key")
        .eq("recipe_id", id);

      if (error) {
        throw error;
      }

      const rows = (data as { utensil_key: string }[]) ?? [];
      return rows.map((r) => r.utensil_key);
    },
    enabled: !!id
  });

  const [selectedUtensils, setSelectedUtensils] = useState<string[]>([]);

  useEffect(() => {
    if (recipeUtensils) {
      setSelectedUtensils(recipeUtensils);
    }
  }, [recipeUtensils]);

  useEffect(() => {
    if (recipe) {
      const safeDietary =
        (recipe.dietary_labels as RecipeFormValues["dietary_labels"]) ?? [];
      const safeServingTempsRaw =
        (recipe.serving_temperatures as string[]) ??
        (recipe.serving_temperature ? [recipe.serving_temperature as string] : []);
      const safeServingTemps =
        safeServingTempsRaw.filter((v): v is RecipeFormValues["serving_temperatures"][number] =>
          ["chaud", "tiede", "ambiante", "froid", "au_choix"].includes(v)
        );
      const safeStorageModesRaw =
        (recipe.storage_modes as string[]) ?? [];
      const safeStorageModes =
        safeStorageModesRaw.filter((v): v is RecipeFormValues["storage_modes"][number] =>
          ["refrigerateur", "congelateur", "ambiante", "sous_vide", "boite_hermetique", "au_choix"].includes(v)
        );

      reset({
        title: recipe.title ?? "",
        slug: recipe.slug ?? "",
        description: recipe.description ?? "",
        image_url: recipe.image_url ?? "",
        prep_time_min: recipe.prep_time_min ?? 0,
        cook_time_min: recipe.cook_time_min ?? 0,
        rest_time_min: recipe.rest_time_min ?? 0,
        servings: recipe.servings ?? 1,
        difficulty:
          (recipe.difficulty as RecipeFormValues["difficulty"]) ??
          "beginner",
        category:
          (recipe.category as RecipeFormValues["category"]) ??
          "plat_principal",
        cuisine: recipe.cuisine ?? "",
        tags: (recipe.tags as string[]) ?? [],
        dietary_labels: safeDietary,
        serving_temperatures: safeServingTemps,
        storage_modes: safeStorageModes,
        status: (recipe.status as RecipeFormValues["status"]) ?? "draft",
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
        storage_instructions: recipe.storage_instructions ?? "",
        storage_duration_days: recipe.storage_duration_days ?? undefined,
        meta_title: recipe.meta_title ?? "",
        meta_description: recipe.meta_description ?? "",
        canonical_url: recipe.canonical_url ?? "",
        og_image_url: recipe.og_image_url ?? "",
        schema_jsonld_enabled: recipe.schema_jsonld_enabled ?? false
      });
    }
  }, [recipe, reset]);

  const watchedTitle = watch("title");
  const watchedDescription = watch("description");
  const watchedSlug = watch("slug");
  const watchedImageUrl = watch("image_url");
  const watchedDifficulty = watch("difficulty");
  const watchedMetaTitle = watch("meta_title");
  const watchedMetaDescription = watch("meta_description");
  const watchedCanonicalUrl = watch("canonical_url");
  const watchedOgImageUrl = watch("og_image_url");
  const watchedDifficultyDetailed = watch("difficulty_detailed");
  const watchedCategory = watch("category");
  const watchedCuisine = watch("cuisine");
  const watchedTags = watch("tags");
  const watchedPrepTime = watch("prep_time_min");
  const watchedCookTime = watch("cook_time_min");
  const watchedServings = watch("servings");
  const watchedIngredientsText = watch("ingredients_text");
  const watchedInstructionsDetailed = watch("instructions_detailed");
  const watchedMetaDescriptionForJsonLd = watch("meta_description");

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
  }, [
    watchedDifficulty,
    watchedDifficultyDetailed,
    setValue
  ]);

  const [prePublishIssues, setPrePublishIssues] = useState<string[]>([]);
  const [showPrePublishModal, setShowPrePublishModal] = useState(false);

  const onSubmit = async (values: RecipeFormValues) => {
    if (!id) return;

    setMessage(null);
    setErrorMessage(null);
    setShowPrePublishModal(false);
    setPrePublishIssues([]);

    const hasImageCandidate =
      !!imageFile ||
      isNonEmpty(values.image_url) ||
      (recipe && isNonEmpty(recipe.image_url));

    if (values.status === "published") {
      const issues = computePrePublishIssues(values, {
        normalizedIngredientsCount: ingredientsCount,
        enrichedStepsCount: stepsCount,
        conceptsCount: recipeConcepts?.length ?? 0
      });
      if (!hasImageCandidate) {
        issues.unshift("Image principale manquante.");
      }
      if (issues.length > 0) {
        setPrePublishIssues(issues);
        setShowPrePublishModal(true);
        setErrorMessage(
          "Publication bloquée : certains éléments obligatoires sont manquants."
        );
        return;
      }
    }

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

      const { error } = await supabase
        .from("recipes")
        .update(payload)
        .eq("id", id);

      if (error) {
        throw error;
      }

      // Synchroniser les ustensiles
      const { error: deleteError } = await supabase
        .from("recipe_utensils")
        .delete()
        .eq("recipe_id", id);
      if (deleteError) {
        throw deleteError;
      }

      if (selectedUtensils.length > 0) {
        const rows = selectedUtensils.map((utensilKey) => ({
          recipe_id: id,
          utensil_key: utensilKey
        }));
        const { error: insertError } = await supabase
          .from("recipe_utensils")
          .insert(rows);
        if (insertError) {
          throw insertError;
        }
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

  const missingFields = useMemo(
    () => (recipe ? getRecipeMissingFields(recipe) : []),
    [recipe]
  );
  const isComplete = missingFields.length === 0;

  const jsonLdObject = useMemo(() => {
    if (!recipe) return null;

    return buildRecipeJsonLd({
      id: recipe.id,
      slug: watchedSlug || recipe.slug || "",
      title: watchedTitle || recipe.title || "",
      description: watchedDescription || recipe.description || "",
      metaDescription:
        watchedMetaDescriptionForJsonLd || recipe.meta_description,
      imageUrl: watchedImageUrl || recipe.image_url,
      category: watchedCategory || recipe.category,
      cuisine: watchedCuisine || recipe.cuisine,
      tags: (watchedTags as string[]) ?? (recipe.tags as string[]) ?? [],
      prepTimeMin:
        typeof watchedPrepTime === "number"
          ? watchedPrepTime
          : recipe.prep_time_min,
      cookTimeMin:
        typeof watchedCookTime === "number"
          ? watchedCookTime
          : recipe.cook_time_min,
      servings:
        typeof watchedServings === "number"
          ? watchedServings
          : recipe.servings,
      ingredientsText: watchedIngredientsText || recipe.ingredients_text,
      instructionsDetailed:
        watchedInstructionsDetailed || recipe.instructions_detailed
    });
  }, [
    recipe,
    watchedSlug,
    watchedTitle,
    watchedDescription,
    watchedMetaDescriptionForJsonLd,
    watchedImageUrl,
    watchedCategory,
    watchedCuisine,
    watchedTags,
    watchedPrepTime,
    watchedCookTime,
    watchedServings,
    watchedIngredientsText,
    watchedInstructionsDetailed
  ]);

  const jsonLdString = useMemo(
    () =>
      jsonLdObject ? JSON.stringify(jsonLdObject, null, 2) : "// JSON-LD généré à partir du formulaire",
    [jsonLdObject]
  );

  const jsonLdIssues = useMemo(
    () => (jsonLdObject ? validateRecipeJsonLd(jsonLdObject) : []),
    [jsonLdObject]
  );

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

  const conceptsCount = recipeConcepts?.length ?? 0;
  const audioUsageCount = recipeAudioUsage?.length ?? 0;
  const embeddingPresent = !!recipe.embedding;
  const ingredientsPresent = ingredientsCount > 0;
  const stepsPresent = stepsCount > 0;
  const seoComplete =
    isNonEmpty(recipe.meta_title) && isNonEmpty(recipe.meta_description);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">
            Édition recette – fiche enrichie
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Organisez les informations de base, les ingrédients, les étapes
            enrichies et le SEO de cette recette.
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
          {id && (
            <Button
              type="button"
              variant="secondary"
              className="text-xs"
              onClick={() => router.push(`/admin/recipes/${id}/preview`)}
            >
              Prévisualiser la page publique
            </Button>
          )}
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

      {/* Panneau d'actions rapides & qualité éditoriale */}
      <section className="card space-y-4 px-5 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
              Qualité éditoriale
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Niveau actuel:{" "}
              {isComplete ? (
                <span className="font-semibold text-emerald-300">
                  recette complète
                </span>
              ) : (
                <span className="font-semibold text-amber-300">
                  recette à enrichir
                </span>
              )}
            </p>
            {missingFields.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {missingFields.map((label) => (
                  <span
                    key={label}
                    className="rounded bg-red-500/10 px-2 py-0.5 text-[11px] text-red-200"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-3 text-xs md:grid-cols-3">
            <div>
              <p className="font-semibold text-slate-200">
                Embedding RAG & search
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {embeddingPresent
                  ? "Embedding présent pour cette recette."
                  : "Embedding manquant ou obsolète."}
              </p>
              <Button
                type="button"
                variant="secondary"
                className="mt-2 inline-flex items-center gap-2 text-[11px]"
                onClick={handleRecomputeEmbedding}
              >
                Générer / recalculer l&apos;embedding
              </Button>
            </div>

            <div>
              <p className="font-semibold text-slate-200">Concepts science</p>
              <p className="mt-1 text-[11px] text-slate-500">
                {conceptsCount} concept(s) lié(s) via{" "}
                <code className="rounded bg-slate-800/80 px-1">
                  recipe_concepts
                </code>
                .
              </p>
              <Button
                type="button"
                variant="secondary"
                className="mt-2 inline-flex items-center gap-2 text-[11px]"
                onClick={() => router.push("/admin/knowledge")}
              >
                Gérer la base de connaissances
              </Button>
            </div>

            <div>
              <p className="font-semibold text-slate-200">Audio</p>
              <p className="mt-1 text-[11px] text-slate-500">
                {audioUsageCount > 0
                  ? `${audioUsageCount} utilisation(s) audio tracée(s) pour cette recette.`
                  : "Aucun usage audio enregistré pour cette recette."}
              </p>
              <Button
                type="button"
                variant="secondary"
                className="mt-2 inline-flex items-center gap-2 text-[11px]"
                onClick={() => router.push("/admin/audio")}
              >
                Gérer la bibliothèque audio
              </Button>
            </div>
          </div>

          <div className="mt-4 border-t border-slate-800 pt-3 text-xs">
            <p className="font-semibold text-slate-200">
              Checklist RAG (structure)
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              <span
                className={`rounded px-2 py-0.5 text-[11px] ${
                  ingredientsPresent
                    ? "bg-emerald-500/10 text-emerald-300"
                    : "bg-amber-500/10 text-amber-200"
                }`}
              >
                Ingrédients normalisés :{" "}
                {ingredientsPresent
                  ? `${ingredientsCount} ligne(s)`
                  : "⚠️ aucun ingrédient normalisé"}
              </span>
              <span
                className={`rounded px-2 py-0.5 text-[11px] ${
                  stepsPresent
                    ? "bg-emerald-500/10 text-emerald-300"
                    : "bg-amber-500/10 text-amber-200"
                }`}
              >
                Étapes enrichies :{" "}
                {stepsPresent
                  ? `${stepsCount} étape(s)`
                  : "⚠️ aucune étape enrichie"}
              </span>
              <span
                className={`rounded px-2 py-0.5 text-[11px] ${
                  conceptsCount > 0
                    ? "bg-emerald-500/10 text-emerald-300"
                    : "bg-amber-500/10 text-amber-200"
                }`}
              >
                Concepts liés :{" "}
                {conceptsCount > 0
                  ? `${conceptsCount} concept(s)`
                  : "⚠️ aucun concept scientifique"}
              </span>
              <span
                className={`rounded px-2 py-0.5 text-[11px] ${
                  seoComplete
                    ? "bg-emerald-500/10 text-emerald-300"
                    : "bg-amber-500/10 text-amber-200"
                }`}
              >
                SEO :{" "}
                {seoComplete
                  ? "Titre + description remplis"
                  : "⚠️ Titre ou description SEO manquant(e)"}
              </span>
            </div>
          </div>
        </div>
      </section>

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

        {/* Onglet 2bis : Repos & conservation */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-100">
            2bis. Repos &amp; conservation
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

        {/* Onglet 3 : Ustensiles / matériel */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-100">
            3. Ustensiles / matériel
          </h2>
          <p className="text-xs text-slate-500">
            Sélectionne les ustensiles et équipements importants nécessaires pour
            réaliser la recette (four, airfryer, Thermomix, etc.).
          </p>
          <div className="flex flex-wrap gap-3 text-xs">
            {utensilsCatalog.length === 0 ? (
              <p className="text-slate-500">
                Aucun ustensile n&apos;est encore défini dans le catalogue.
              </p>
            ) : (
              utensilsCatalog.map((utensil) => {
                const checked = selectedUtensils.includes(utensil.key);
                return (
                  <label
                    key={utensil.key}
                    className="inline-flex items-center gap-2 text-slate-200"
                  >
                    <input
                      type="checkbox"
                      className="h-3 w-3 accent-primary-500"
                      checked={checked}
                      onChange={() => {
                        setSelectedUtensils((prev) =>
                          prev.includes(utensil.key)
                            ? prev.filter((k) => k !== utensil.key)
                            : [...prev, utensil.key]
                        );
                      }}
                    />
                    <span>{utensil.label}</span>
                  </label>
                );
              })
            )}
          </div>
        </section>

        {/* Onglet 4 : Texte détaillé & enrichissement */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-100">
            4. Texte détaillé &amp; enrichissement
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
                d&apos;upload, le fichier est stocké dans Supabase Storage
                (taille max 5 Mo).
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

        {/* Onglet 4bis : SEO avancé & JSON-LD */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-100">
            5. SEO avancé – Schema.org Recipe (JSON-LD)
          </h2>
          <p className="text-xs text-slate-500">
            Le JSON-LD ci-dessous est généré automatiquement à partir des champs
            de la recette. Il pourra être injecté côté front pour améliorer la
            compréhension de la recette par les moteurs de recherche.
          </p>

          <div className="flex items-center gap-2">
            <input
              id="schema_jsonld_enabled"
              type="checkbox"
              className="h-3 w-3 accent-primary-500"
              {...register("schema_jsonld_enabled")}
            />
            <label
              htmlFor="schema_jsonld_enabled"
              className="text-xs text-slate-200"
            >
              Inclure le JSON-LD Schema.org sur la page recette (flag pour le
              front)
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-1">
              <p className="mb-1 text-[11px] font-semibold text-slate-300">
                JSON-LD généré
              </p>
              <pre className="max-h-64 overflow-auto rounded-md border border-slate-800 bg-slate-950/60 p-3 text-[11px] text-slate-100">
                {jsonLdString}
              </pre>
            </div>
            <div className="md:col-span-1">
              <p className="mb-1 text-[11px] font-semibold text-slate-300">
                Validation de base
              </p>
              {jsonLdIssues.length === 0 ? (
                <p className="text-[11px] text-emerald-300">
                  Le JSON-LD contient les champs essentiels (name, description,
                  image, ingrédients, instructions).
                </p>
              ) : (
                <ul className="list-disc space-y-1 pl-4 text-[11px] text-amber-300">
                  {jsonLdIssues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[11px] text-slate-500">
                Pour une validation complète, utilise l&apos;outil de test de
                données structurées de Google ou Schema.org sur l&apos;URL
                publique correspondante.
              </p>
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

      {/* Onglet 5 : Ingrédients structurés */}
      {id && (
        <section className="card mt-4 space-y-4 px-5 py-5">
          <RecipeIngredientsEditor recipeId={id} />
        </section>
      )}

      {/* Onglet 6 : Étapes enrichies */}
      {id && (
        <section className="card mt-4 space-y-4 px-5 py-5">
          <RecipeStepsEditor recipeId={id} />
        </section>
      )}

      {/* Onglet 7 : Concepts scientifiques */}
      {id && (
        <section className="card mt-4 space-y-4 px-5 py-5">
          <RecipeConceptsEditor recipeId={id} />
        </section>
      )}
    </div>
  );
};

export default AdminEditRecipePage;