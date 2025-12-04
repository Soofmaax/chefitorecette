import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { articleSchema, ArticleFormValues } from "@/types/forms";
import { supabase } from "@/lib/supabaseClient";
import { generateSlug } from "@/lib/slug";
import { extractTextFromHTML } from "@/lib/text";
import { cacheContentInRedis } from "@/lib/integrations";
import { TagInput } from "@/components/ui/TagInput";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

const EditArticlePage = () => {
  const router = useRouter();
  const { id } = router.query;

  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    const fetchArticle = async (articleId: string) => {
      setLoading(true);
      setErrorMessage(null);
      setMessage(null);

      const { data, error } = await supabase
        .from("posts")
        .select(
          "id, slug, title, excerpt, content_html, cover_image_url, tags, category, status, published_at, cache_key, content_text, rag_metadata"
        )
        .eq("id", articleId)
        .single();

      if (error) {
        // eslint-disable-next-line no-console
        console.error(error);
        setErrorMessage(
          "Erreur lors du chargement de l’article. Veuillez réessayer."
        );
        setLoading(false);
        return;
      }

      if (!data) {
        setErrorMessage("Article introuvable.");
        setLoading(false);
        return;
      }

      reset({
        title: data.title ?? "",
        slug: data.slug ?? "",
        excerpt: data.excerpt ?? "",
        content_html: data.content_html ?? "",
        status: (data.status as ArticleFormValues["status"]) ?? "draft",
        category: data.category ?? "",
        tags: (data.tags as string[]) ?? [],
        cover_image_url: data.cover_image_url ?? "",
        publish_at: data.published_at
          ? new Date(data.published_at).toISOString().slice(0, 16)
          : ""
      });

      setLoading(false);
    };

    if (typeof id === "string") {
      fetchArticle(id);
    }
  }, [id, reset]);

  const onSubmit = async (values: ArticleFormValues) => {
    if (typeof id !== "string") return;

    setMessage(null);
    setErrorMessage(null);

    try {
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
        excerpt: values.excerpt,
        content_html: values.content_html,
        cover_image_url: values.cover_image_url || null,
        tags: values.tags,
        category: values.category,
        status: values.status,
        published_at:
          values.status === "published" ? publishAtIso ?? new Date().toISOString() : null
      };

      const { data: updated, error } = await supabase
        .from("posts")
        .update(payload)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Recalculer et mettre à jour le cache Redis de base (texte brut)
      const contentForCache = {
        id: updated.id,
        title: updated.title,
        excerpt: updated.excerpt,
        content_text: extractTextFromHTML(updated.content_html),
        tags: updated.tags,
        category: updated.category,
        created_at: updated.created_at
      };
      const cacheKey = `content:${updated.id}`;
      try {
        await cacheContentInRedis(cacheKey, contentForCache);
        await supabase
          .from("posts")
          .update({ cache_key: cacheKey })
          .eq("id", updated.id);
      } catch {
        // on ne bloque pas l'édition si le cache échoue
      }

      setMessage(
        "Article mis à jour avec succès. Relancez l’enrichissement RAG depuis la liste si nécessaire."
      );
      // eslint-disable-next-line no-console
      console.log("Article mis à jour :", updated);
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error(err);
      setErrorMessage(
        err?.message ?? "Erreur lors de la mise à jour de l’article."
      );
    }
  };

  const handleDelete = async () => {
    if (typeof id !== "string") return;

    // eslint-disable-next-line no-alert
    const confirm = window.confirm(
      "Voulez-vous vraiment supprimer cet article ? Cette action est irréversible."
    );
    if (!confirm) return;

    try {
      const { error } = await supabase.from("posts").delete().eq("id", id);
      if (error) {
        throw error;
      }
      router.push("/articles");
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error(err);
      setErrorMessage(
        err?.message ?? "Erreur lors de la suppression de l’article."
      );
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner className="mr-2" />
        <span className="text-sm text-slate-400">
          Chargement de l’article…
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">
            Éditer l’article
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Modifiez le contenu éditorial qui alimente le système RAG.
          </p>
        </div>
        <Link href="/articles" legacyBehavior>
          <a>
            <Button variant="secondary">Retour à la liste</Button>
          </a>
        </Link>
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
              Utilisé pour l’URL publique. Laissez vide pour régénérer depuis le
              titre.
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
              <span>Mettre à jour l’article</span>
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

export default EditArticlePage;