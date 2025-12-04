import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { recipeSchema, RecipeFormValues } from "@/types/forms";
import { supabase, getCurrentUser } from "@/lib/supabaseClient";
import { TagInput } from "@/components/ui/TagInput";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

const NewRecipePage = () => {
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
      description: "",
      ingredients: [],
      instructions: "",
      category: "",
      tags: [],
      image_url: ""
    }
  });

  const onSubmit = async (values: RecipeFormValues) => {
    setMessage(null);
    setErrorMessage(null);

    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error("Utilisateur non connecté");
      }

      const payload = {
        title: values.title,
        description: values.description,
        ingredients: values.ingredients,
        instructions: values.instructions,
        category: values.category,
        tags: values.tags,
        image_url: values.image_url || null,
        user_id: user.id,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from("recipes")
        .insert([payload])
        .select()
        .single();

      if (error) {
        throw error;
      }

      setMessage(
        "Recette créée avec succès. L’embedding sera généré automatiquement par la fonction Edge."
      );
      reset({
        title: "",
        description: "",
        ingredients: [],
        instructions: "",
        category: "",
        tags: [],
        image_url: ""
      });
      // data contient la recette insérée si besoin de l'utiliser
      // eslint-disable-next-line no-console
      console.log("Recette créée :", data);
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
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-50">
          Nouvelle recette
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Ajoutez une recette. Les embeddings seront générés automatiquement via
          Supabase (Edge Functions / triggers).
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="card space-y-5 px-5 py-5"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
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

          <div className="md:col-span-2">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              rows={3}
              className="mt-1 w-full"
              placeholder="Brève description de la recette…"
              {...register("description")}
            />
            {errors.description && (
              <p className="form-error">{errors.description.message}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label>Ingrédients</label>
            <Controller
              control={control}
              name="ingredients"
              render={({ field }) => (
                <TagInput
                  value={field.value ?? []}
                  onChange={field.onChange}
                  placeholder="Ajoutez un ingrédient et validez avec Entrée (ex : 200g farine)"
                />
              )}
            />
            {errors.ingredients && (
              <p className="form-error">{errors.ingredients.message}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="instructions">Instructions</label>
            <textarea
              id="instructions"
              rows={6}
              className="mt-1 w-full"
              placeholder="Détaillez les étapes de préparation de la recette…"
              {...register("instructions")}
            />
            {errors.instructions && (
              <p className="form-error">{errors.instructions.message}</p>
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

          <div className="md:col-span-2">
            <label htmlFor="image_url">Image URL (optionnel)</label>
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
        </div>

        <div className="flex items-center justify-between gap-3">
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2"
          >
            {isSubmitting && (
              <LoadingSpinner size="sm" className="text-slate-100" />
            )}
            <span>Enregistrer la recette</span>
          </Button>

          {message && (
            <p className="text-xs text-emerald-300">{message}</p>
          )}
          {errorMessage && (
            <p className="text-xs text-red-300">{errorMessage}</p>
          )}
        </div>
      </form>
    </div>
  );
};

export default NewRecipePage;