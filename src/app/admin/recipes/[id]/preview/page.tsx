"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

const AdminRecipePreviewPage = () => {
  const params = useParams();
  const id = params?.id as string | undefined;

  if (!id) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold tracking-tight text-slate-50">
          Prévisualisation recette
        </h1>
        <p className="text-sm text-red-300">
          Identifiant de recette manquant dans l’URL.
        </p>
      </div>
    );
  }

  const publicUrl = `/recipes/${id}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">
            Prévisualisation – page publique
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Cette vue affiche la page publique actuelle de la recette dans un
            iframe. Utilise-la pour vérifier le rendu après tes modifications
            dans l’éditeur.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            URL publique cible :{" "}
            <code className="rounded bg-slate-900 px-1 py-0.5 text-[11px]">
              {publicUrl}
            </code>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/admin/recipes/${id}/edit`}>
            <Button variant="secondary" className="text-xs">
              Retour à l’édition
            </Button>
          </Link>
          <Link href={publicUrl} target="_blank">
            <Button variant="secondary" className="text-xs">
              Ouvrir la page publique dans un nouvel onglet
            </Button>
          </Link>
        </div>
      </div>

      <div className="card overflow-hidden border border-slate-800 bg-black/60">
        <div className="border-b border-slate-800 px-4 py-2 text-xs text-slate-400">
          Aperçu intégré de{" "}
          <code className="rounded bg-slate-900 px-1 py-0.5 text-[11px]">
            {publicUrl}
          </code>
        </div>
        <div className="h-[720px] w-full">
          <iframe
            src={publicUrl}
            title="Prévisualisation recette"
            className="h-full w-full border-0"
          />
        </div>
      </div>
    </div>
  );
};

export default AdminRecipePreviewPage;