import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { articleSchema, ArticleFormValues } from "@/types/forms";
import { supabase, getCurrentUser } from "@/lib/supabaseClient";
import { generateSlug } from "@/lib/slug";
import { extractTextFromHTML } from "@/lib/text";
import { cacheContentInRedis } from "@/lib/integrations";
import { TagInput } from "@/components/ui/TagInput";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

const NewArticlePage = () => {
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<ArticleFormValues>({
    resolver: zodResolver(articleSchema),
    defaultValues: {
      title: "",
      excerpt: "",
      content_html: "",
      status: "draft",
      category: "",
      tags: []
    }
  });

  const onSubmit = async (values: ArticleFormValues) => {
    setMessage(null);
    setErrorMessage(null);

    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error("Utilisateur non connecté");
      }

      const slug = generateSlug(values.title);

      // 1. Insertion dans la table posts
      const payload = {
        ...values,
        slug,
        user_id: user.id,
        enrichment_status: "pending",
        status: values.status === "published" ? "published" : "draft"
      };

      const { data: article, error } = await supabase
        .from("posts")
        .insert([payload])
        .select()
        .single();

      if (error) {
        throw error;
      }

      // 2. Cache Redis du contenu textuel pour accès rapide
      const contentForCache = {
        id: article.id,
        title: article.title,
        excerpt: article.excerpt,
        content_text: extractTextFromHTML(article.content_html),
        tags: article.tags,
        category: article.category,
        created_at: article.created_at
      };

      const cacheKey = `content:${article.id}`;
      await cacheContentInRedis(cacheKey, contentForCache);

      // 3. Déclenchement de l'enrichissement (Edge Function RAG)
      const { data: enrichmentData, error: enrichmentError } =
        await supabase.functions.invoke("generate-post-embedding", {
          body: { post_id: article.id, post_data: values }
        });

      if (enrichmentError) {
        throw enrichmentError;
      }

      const enrichmentResponse = enrichmentData as any;

      // 4. Mise à jour du statut et des métadonnées S3/cache
      const { error: updateError } = await supabase
        .from("posts")
        .update({
          s3_vector_key: enrichmentResponse?.s3Key ?? null,
          cache_key: cacheKey,
          enrichment_status: enrichmentResponse?.success ? "completed" : "failed",
          published_at:
            values.status === "published"
              ? new Date().toISOString()
              : null
        })
        .eq("id", article.id);

      if (updateError) {
        throw updateError;
      }

      setMessage(
        "Article créé et enrichissement RAG déclenché (embedding, S3, cache Redis)."
      );
      reset({
        title: "",
        excerpt: "",
        content_html: "",
        status: "draft",
        category: "",
        tags: []
      });
      // eslint-disable-next-line no-console
      console.log("Article créé :", article, enrichmentResponse);
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error(err);
      setErrorMessage(
        err?.message ?? "Erreur lors de la création de l’article."
      );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-50">
          Nouvel article
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Créez un article. Le contenu sera automatiquement enrichi par le
          système RAG (texte, points clés, thèmes, contexte culturel,
          embeddings S3, cache Redis).
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="card space-y-5 px-5 py-5"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="title">Titre</label>
            <input
              id="title"
              type="text"
              className="mt-1 w-full"
              placeholder="Titre de l’article"
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
              placeholder="Catégorie éditoriale"
              {...register("category")}
            />
            {errors.category && (
              <p className="form-error">{errors.category.message}</p>
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
              <option value="published">Publié</option>
            </select>
            {errors.status && (
              <p className="form-error">{errors.status.message}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="excerpt">Extrait</label>
            <textarea
              id="excerpt"
              rows={3}
              className="mt-1 w-full"
              placeholder="Résumé court pour les listes et aperçus…"
              {...register("excerpt")}
            />
            {errors.excerpt && (
              <p className="form-error">{errors.excerpt.message}</p>
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
                  placeholder="Ajoutez des tags éditoriaux"
                />
              )}
            />
            {errors.tags && (
              <p className="form-error">{errors.tags.message as string}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="content_html">Contenu HTML</label>
            <textarea
              id="content_html"
              rows={10}
              className="mt-1 w-full font-mono text-xs"
              placeholder="<p>Contenu HTML de l’article…</p>"
              {...register("content_html")}
            />
            {errors.content_html && (
              <p className="form-error">{errors.content_html.message}</p>
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
            <span>Enregistrer l’article</span>
          </Button>

          {message && <p className="text-xs text-emerald-300">{message}</p>}
          {errorMessage && (
            <p className="text-xs text-red-300">{errorMessage}</p>
          )}
        </div>
      </form>
    </div>
  );
};

export default NewArticlePage;