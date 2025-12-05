import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { recipeSchema, RecipeFormValues } from "@/types/forms";
import { supabase } from "@/lib/supabaseClient";
import { uploadRecipeImage } from "@/lib/storage";
import { generateSlug } from "@/lib/slug";
import { TagInput } from "@/components/ui/TagInput";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

const EditRecipePage = () => {
  const router = useRouter();
  const { id } = router.query;

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

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

  const slugAutoRef = useRef<string | null>(null);
  const watchedTitle = watch("title");
  const watchedSlug = watch("slug");
  const watchedDescription = watch("description");
  const watchedIngredientsText = watch("ingredients_text");
  const watchedImageUrl = watch("image_url");

  useEffect(() => {
    if (!watchedTitle) return;

    const autoSlug = generateSlug(watchedTitle);

    if (!autoSlug) {
      return;
    }

    if (!watchedSlug || watchedSlug === slugAutoRef.current) {
      setValue("slug", autoSlug, { shouldValidate: true, shouldDirty: true });
      slugAutoRef.current = autoSlug;
    }
  }, [watchedTitle, watchedSlug, setValue]);

  useEffect(() => {
    const fetchRecipe = async (recipeId: string) => {
      setLoading(true);
      setErrorMessage(null);
      setMessage(null);

      const { data, error } = await supabase
        .from("recipes")
        .select(
          "id, slug, title, description, image_url, prep_time_min, cook_time_min, rest_time_min, servings, difficulty, category, cuisine, tags, dietary_labels, status, publish_at, ingredients_text, instructions_detailed, chef_tips, cultural_history, techniques, source_info, difficulty_detailed, nutritional_notes, storage_instructions, storage_duration_days, serving_temperatures, storage_modes, serving_temperature, meta_title, meta_description, canonical_url, og_image_url, schema_jsonld_enabled"
        )
        .eq("id", recipeId)
        .single();

      if (error) {
        // eslint-disable-next-line no-console
        console.error(error);
        setErrorMessage(
          "Erreur lors du chargement de la recette. Veuillez réessayer."
        );
        setLoading(false);
        return;
      }

      if (!data) {
        setErrorMessage("Recette introuvable.");
        setLoading(false);
        return;
      }

      const safeDietary =
        (data.dietary_labels as RecipeFormValues["dietary_labels"]) ?? [];
      const rawServingTemps =
        (data.serving_temperatures as string[]) ??
        (data.serving_temperature ? [data.serving_temperature as string] : []);
      const safeServingTemps =
        rawServingTemps.filter((v): v is RecipeFormValues["serving_temperatures"][number] =>
          ["chaud", "tiede", "ambiante", "froid", "au_choix"].includes(v)
        );
      const rawStorageModes = (data.storage_modes as string[]) ?? [];
      const safeStorageModes =
        rawStorageModes.filter((v): v is RecipeFormValues["storage_modes"][number] =>
          ["refrigerateur", "congelateur", "ambiante", "sous_vide", "boite_hermetique", "au_choix"].includes(v)
        );

      reset({
        title: data.title ?? "",
        slug: data.slug ?? "",
        description: data.description ?? "",
        image_url: data.image_url ?? "",
        prep_time_min: data.prep_time_min ?? 0,
        cook_time_min: data.cook_time_min ?? 0,
        rest_time_min: data.rest_time_min ?? 0,
        servings: data.servings ?? 1,
        difficulty:
          (data.difficulty as RecipeFormValues["difficulty"]) ?? "beginner",
        category:
          (data.category as RecipeFormValues["category"]) ?? "plat_principal",
        cuisine: data.cuisine ?? "",
        tags: (data.tags as string[]) ?? [],
        dietary_labels: safeDietary,
        serving_temperatures: safeServingTemps,
        storage_modes: safeStorageModes,
        status: (data.status as RecipeFormValues["status"]) ?? "draft",
        publish_at: data.publish_at
          ? new Date(data.publish_at).toISOString().slice(0, 16)
          : "",
        ingredients_text: data.ingredients_text ?? "",
        instructions_detailed: data.instructions_detailed ?? "",
        chef_tips: data.chef_tips ?? "",
        cultural_history: data.cultural_history ?? "",
        techniques: data.techniques ?? "",
        source_info: data.source_info ?? "",
        difficulty_detailed: data.difficulty_detailed ?? "",
        nutritional_notes: data.nutritional_notes ?? "",
        storage_instructions: data.storage_instructions ?? "",
        storage_duration_days: data.storage_duration_days ?? undefined,
        meta_title: data.meta_title ?? "",
        meta_description: data.meta_description ?? "",
        canonical_url: data.canonical_url ?? "",
        og_image_url: data.og_image_url ?? "",
        schema_jsonld_enabled: data.schema_jsonld_enabled ?? false
      });

      setLoading(false);
    };

    if (typeof id === "string") {
      fetchRecipe(id);
    }
  }, [id, reset]);

  const onSubmit = async (values: RecipeFormValues) => {
    if (typeof id !== "string") {
      return;
    }

    setMessage(null);
    setErrorMessage(null);

    try {
      // Gérer l'image : URL existante ou nouvel upload
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

      // Slug : utiliser celui fourni ou le générer depuis le titre
      const slug =
        (values.slug && values.slug.trim()) || generateSlug(values.title);

      // publish_at : convertir en ISO si fourni
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
        meta_title: values.meta_title || null,
        meta_description: values.meta_description || null,
        canonical_url: values.canonical_url || null,
        og_image_url: values.og_image_url || null
      };

      const { data: updated, error } = await supabase
        .from("recipes")
        .update(payload)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      setMessage(
        "Recette mise à jour avec succès. Pensez à recalculer l’embedding depuis la liste si vous avez modifié fortement le contenu."
      );
      // eslint-disable-next-line no-console
      console.log("Recette mise à jour :", updated);
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error(err);
      setErrorMessage(
        err?.message ?? "Erreur lors de la mise à jour de la recette."
      );
    }
  };

  const handleDelete = async () => {
    if (typeof id !== "string") {
      return;
    }

    // eslint-disable-next-line no-alert
    const confirm = window.confirm(
      "Voulez-vous vraiment supprimer cette recette ? Cette action est irréversible."
    );
    if (!confirm) return;

    try {
      const { error } = await supabase.from("recipes").delete().eq("id", id);
      if (error) {
        throw error;
      }
      router.push("/recipes");
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error(err);
      setErrorMessage(
        err?.message ?? "Erreur lors de la suppression de la recette."
      );
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner className="mr-2" />
        <span className="text-sm text-slate-400">
          Chargement de la recette…
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">
            Éditer la recette
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Modifiez la fiche complète de la recette. Cette fiche alimente le
            système RAG et le site public.
          </p>
        </div>
        <Link href="/recipes" legacyBehavior>
          <a>
            <Button variant="secondary">Retour à la liste</Button>
          </a>
        </Link>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="card space-y-6 px-5 py-5"
      >
        {/* Bloc titre / slug / description */}
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
              Utilisé pour l’URL publique. Laissez vide pour le régénérer
              automatiquement à partir du titre.
            </p>
          </div>

          <div>
            <label htmlFor="category">Catégorie</label>
            <select
              id="category"
              className="mt-1 w-full"
              {...register("category")}
            >
              <option value="entree">Entrée</option>
              <option value="plat_principal">Plat principal</option>
              <option value="accompagnement">Accompagnement</option>
              <option value="dessert">Dessert</option>
              <option value="aperitif">Apéritif</option>
              <option value="gateau">Gâteau</option>
              <option value="boisson">Boisson</option>
              <option value="sauce">Sauce</option>
              <option value="test">Test</option>
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

        {/* Bloc temps / portions / difficulté / statut */}
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
              Optionnel. Utilisé si le statut est{" "}
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

        {/* Bloc régimes / service / conservation */}
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label>Régimes / mentions</label>
            <Controller
              control={control}
              name="dietary_labels"
              render={({ field }) => {
                const current = field.value ?? [];
                return (
                  <div className="mt-1 space-y-1 rounded-md border border-slate-700 bg-slate-900 p-2">
                    <div className="grid gap-1 text-xs text-slate-200">
                      {[
                        { value: "vegetarien", label: "Végétarien" },
                        { value: "vegetalien", label: "Végétalien" },
                        { value: "vegan", label: "Végan" },
                        { value: "pescetarien", label: "Pescetarien" },
                        { value: "sans_gluten", label: "Sans gluten" },
                        { value: "sans_lactose", label: "Sans lactose" },
                        { value: "sans_oeuf", label: "Sans œuf" },
                        { value: "sans_arachide", label: "Sans arachide" },
                        {
                          value: "sans_fruits_a_coque",
                          label: "Sans fruits à coque"
                        },
                        { value: "sans_soja", label: "Sans soja" },
                        {
                          value: "sans_sucre_ajoute",
                          label: "Sans sucre ajouté"
                        },
                        {
                          value: "sans_sel_ajoute",
                          label: "Sans sel ajouté"
                        },
                        { value: "halal", label: "Halal" },
                        { value: "casher", label: "Casher" }
                      ].map((option) => {
                        const checked = current.includes(
                          option.value as (typeof current)[number]
                        );
                        return (
                          <label
                            key={option.value}
                            className="inline-flex items-center gap-2"
                          >
                            <input
                              type="checkbox"
                              className="h-3 w-3 rounded border-slate-600 bg-slate-900"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  field.onChange([...current, option.value]);
                                } else {
                                  field.onChange(
                                    current.filter((v) => v !== option.value)
                                  );
                                }
                              }}
                            />
                            <span>{option.label}</span>
                          </label>
                        );
                      })}
                    </div>
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

          <div>
            <label>Température de service</label>
            <Controller
              control={control}
              name="serving_temperatures"
              render={({ field }) => {
                const current = field.value ?? [];
                return (
                  <div className="mt-1 space-y-1 rounded-md border border-slate-700 bg-slate-900 p-2 text-xs text-slate-200">
                    {[
                      { value: "chaud", label: "Chaude" },
                      { value: "tiede", label: "Tiède" },
                      { value: "ambiante", label: "Température ambiante" },
                      { value: "froid", label: "Froide" },
                      { value: "au_choix", label: "Au choix" }
                    ].map((option) => {
                      const checked = current.includes(
                        option.value as (typeof current)[number]
                      );
                      return (
                        <label
                          key={option.value}
                          className="inline-flex items-center gap-2"
                        >
                          <input
                            type="checkbox"
                            className="h-3 w-3 rounded border-slate-600 bg-slate-900"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                field.onChange([...current, option.value]);
                              } else {
                                field.onChange(
                                  current.filter((v) => v !== option.value)
                                );
                              }
                            }}
                          />
                          <span>{option.label}</span>
                        </label>
                      );
                    })}
                  </div>
                );
              }}
            />
            {errors.serving_temperatures && (
              <p className="form-error">
                {errors.serving_temperatures.message as string}
              </p>
            )}
          </div>

          <div>
            <label>Modes de conservation</label>
            <Controller
              control={control}
              name="storage_modes"
              render={({ field }) => {
                const current = field.value ?? [];
                return (
                  <div className="mt-1 space-y-1 rounded-md border border-slate-700 bg-slate-900 p-2 text-xs text-slate-200">
                    {[
                      { value: "refrigerateur", label: "Réfrigérateur" },
                      { value: "congelateur", label: "Congélateur" },
                      { value: "ambiante", label: "Température ambiante" },
                      { value: "sous_vide", label: "Sous vide" },
                      {
                        value: "boite_hermetique",
                        label: "Boîte hermétique"
                      },
                      { value: "au_choix", label: "Au choix" }
                    ].map((option) => {
                      const checked = current.includes(
                        option.value as (typeof current)[number]
                      );
                      return (
                        <label
                          key={option.value}
                          className="inline-flex items-center gap-2"
                        >
                          <input
                            type="checkbox"
                            className="h-3 w-3 rounded border-slate-600 bg-slate-900"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                field.onChange([...current, option.value]);
                              } else {
                                field.onChange(
                                  current.filter((v) => v !== option.value)
                                );
                              }
                            }}
                          />
                          <span>{option.label}</span>
                        </label>
                      );
                    })}
                  </div>
                );
              }}
            />
            {errors.storage_modes && (
              <p className="form-error">
                {errors.storage_modes.message as string}
              </p>
            )}
          </div>
        </div>

        {/* Bloc texte détaillé */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="ingredients_text">Ingrédients (une ligne par ingrédient)</label>
            <textarea
              id="ingredients_text"
              rows={6}
              className="mt-1 w-full font-mono text-xs"
              placeholder={"200 g farine\n100 g beurre\n3 pommes…"}
              {...register("ingredients_text")}
            />
            {errors.ingredients_text && (
              <p className="form-error">{errors.ingredients_text.message}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="instructions_detailed">Instructions détaillées</label>
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
            <label htmlFor="chef_tips">Astuces du chef</label>
            <textarea
              id="chef_tips"
              rows={4}
              className="mt-1 w-full"
              placeholder="Conseils pratiques, astuces de cuisson…"
              {...register("chef_tips")}
            />
          </div>

          <div>
            <label htmlFor="cultural_history">Histoire / contexte culturel</label>
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
              placeholder="Techniques de cuisine importantes pour cette recette…"
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

        {/* Bloc image */}
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
              Vous pouvez soit fournir une URL d&apos;image, soit uploader un
              fichier. En cas d&apos;upload, le fichier sera stocké dans
              Supabase Storage avec un nom basé sur le titre de la recette.
            </p>
          </div>
        </div>

        {/* Bloc SEO */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="meta_title">Titre SEO</label>
              <button
                type="button"
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-200 hover:bg-slate-800"
                onClick={() => {
                  const title = (watchedTitle || "").trim();
                  if (!title) return;
                  const seoTitle = `Recette de ${title}`;
                  setValue("meta_title", seoTitle, {
                    shouldDirty: true,
                    shouldValidate: true
                  });
                }}
              >
                Générer depuis le titre
              </button>
            </div>
            <input
              id="meta_title"
              type="text"
              className="mt-1 w-full"
              placeholder="Titre optimisé pour Google (50-60 caractères)"
              {...register("meta_title")}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="meta_description">Description Meta</label>
              <button
                type="button"
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-200 hover:bg-slate-800"
                onClick={() => {
                  const desc = (watchedDescription || "").trim();
                  const ingredientsLines = (watchedIngredientsText || "")
                    .split("\n")
                    .map((l) => l.trim())
                    .filter(Boolean)
                    .slice(0, 3);

                  let base = desc;
                  if (!base && ingredientsLines.length) {
                    base = `Ingrédients principaux : ${ingredientsLines.join(
                      ", "
                    )}`;
                  } else if (base && ingredientsLines.length) {
                    base = `${base} Ingrédients principaux : ${ingredientsLines.join(
                      ", "
                    )}.`;
                  }

                  const trimmed = base.trim();
                  if (!trimmed) return;

                  const finalText =
                    trimmed.length > 160
                      ? `${trimmed.slice(0, 157).trimEnd()}…`
                      : trimmed;

                  setValue("meta_description", finalText, {
                    shouldDirty: true,
                    shouldValidate: true
                  });
                }}
              >
                Générer depuis la description
              </button>
            </div>
            <textarea
              id="meta_description"
              rows={3}
              className="mt-1 w-full"
              placeholder="Description pour les résultats Google (150-160 caractères)"
              {...register("meta_description")}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="canonical_url">URL canonique</label>
              <button
                type="button"
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-200 hover:bg-slate-800"
                onClick={() => {
                  const slug = (watchedSlug || "").trim();
                  if (!slug) return;
                  const basePath = `/recettes/${slug}`;
                  const canonical = process.env.NEXT_PUBLIC_SITE_URL
                    ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}${basePath}`
                    : basePath;
                  setValue("canonical_url", canonical, {
                    shouldDirty: true,
                    shouldValidate: true
                  });
                }}
              >
                Générer depuis le slug
              </button>
            </div>
            <input
              id="canonical_url"
              type="url"
              className="mt-1 w-full"
              placeholder="https://monsite.com/recettes/..."
              {...register("canonical_url")}
            />
            {errors.canonical_url && (
              <p className="form-error">{errors.canonical_url.message}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="og_image_url">Image Open Graph</label>
              <button
                type="button"
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-200 hover:bg-slate-800"
                onClick={() => {
                  const url = (watchedImageUrl || "").trim();
                  if (!url) return;
                  setValue("og_image_url", url, {
                    shouldDirty: true,
                    shouldValidate: true
                  });
                }}
              >
                Copier l&apos;image principale
              </button>
            </div>
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

export default EditRecipePage;