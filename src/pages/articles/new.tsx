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
      slug: "",
      excerpt: "",
      content_html: "",
      status: "draft",
      category: "",
      tags: [],
      cover_image_url: "",
      publish_at: ""
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

      // 1. Insertion dans la table posts
      const payload = {
        slug,
        title: values.title,
        excerpt: values.excerpt,
        content_html: values.content_html,
        cover_image_url: values.cover_image_url || null,
        tags: values.tags,
        category: values.category,
        status: values.status,
        published_at:
          values.status === "published" ? publishAtIso ?? new Date().toISOString() : null,
        author_id: user.id,
        enrichment_status: "pending"
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

      if (!enrichmentResponse?.success) {
        const msg =
          enrichmentResponse?.error ??
          enrichmentResponse?.message ??
          "Échec de l’enrichissement RAG.";
        throw new Error(msg);
      }

      const enrichment = enrichmentResponse.enrichmentData ?? {};

      // 4. Mise à jour du contenu enrichi et des métadonnées de cache
      const updatePayload: any = {
        cache_key: cacheKey,
        content_text: enrichment.content_text,
        key_points: enrichment.key_concepts,
        enrichment_status: enrichment.enrichment_status ?? "completed",
        rag_metadata: enrichment.rag_metadata
      };

      if (values.status === "published") {
        updatePayload.published_at =
          publishAtIso ?? new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from("posts")
        .update(updatePayload)
        .eq("id", article.id);

      if (updateError) {
        throw updateError;
      }

      setMessage(
        "Article créé et enrichissement RAG déclenché (texte enrichi, embedding, cache Redis)."
      );
      reset({
        title: "",
        slug: "",
        excerpt: "",
        content_html: "",
        status: "draft",
        category: "",
        tags: [],
        cover_image_url: "",
        publish_at: ""
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
          Créez un article éditorial qui alimentera le système RAG (texte,
          points clés, métadonnées).
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="card space-y-6 px-5 py-5"
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
            <label htmlFor="slug">Slug</label>
            <input
              id="slug"
              type="text"
              className="mt-1 w-full"
              placeholder="titre-de-l-article"
              {...register("slug")}
            />
            <p className="mt-1 text-xs text-slate-500">
              Laissez vide pour générer automatiquement depuis le titre.
            </p>
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
              <span className="font-semibold">programmé</span> ou{" "}
              <span className="font-semibold">publié</span>.
            </p>
          </div>

          <div>
            <label htmlFor="cover_image_url">Image de couverture</label>
            <input
              id="cover_image_url"
              type="url"
              className="mt-1 w-full"
              placeholder="https://monsite.com/images/article.jpg"
              {...register("cover_image_url")}
            />
            {errors.cover_image_url && (
              <p className="form-error">{errors.cover_image_url.message}</p>
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