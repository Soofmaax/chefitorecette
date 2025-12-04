import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const bodySchema = z.object({
  canonicalId: z.string().uuid(),
  duplicateId: z.string().uuid(),
  alertId: z.string().uuid().optional()
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Requête invalide", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { canonicalId, duplicateId, alertId } = parsed.data;

  if (canonicalId === duplicateId) {
    return NextResponse.json(
      { error: "Les deux identifiants de recette doivent être distincts." },
      { status: 400 }
    );
  }

  try {
    // 1. Repointer les tables dependantes principales
    const tablesToUpdate = [
      "recipe_embeddings",
      "recipe_ingredients_normalized",
      "recipe_steps_enhanced",
      "recipe_concepts",
      "audio_usage_stats"
    ];

    for (const table of tablesToUpdate) {
      const { error } = await supabaseAdmin
        .from(table)
        .update({ recipe_id: canonicalId })
        .eq("recipe_id", duplicateId);

      if (error) {
        throw error;
      }
    }

    // 2. Ajuster les relations parent/enfant
    const { data: relationships, error: relError } = await supabaseAdmin
      .from("recipe_relationships")
      .select("id, parent_recipe_id, child_recipe_id")
      .or(
        `parent_recipe_id.eq.${duplicateId},child_recipe_id.eq.${duplicateId}`
      );

    if (relError) {
      throw relError;
    }

    if (relationships && relationships.length > 0) {
      for (const rel of relationships) {
        const newParent =
          rel.parent_recipe_id === duplicateId
            ? canonicalId
            : rel.parent_recipe_id;
        const newChild =
          rel.child_recipe_id === duplicateId
            ? canonicalId
            : rel.child_recipe_id;

        // Éviter les auto-références
        if (newParent === newChild) {
          const { error: deleteRelError } = await supabaseAdmin
            .from("recipe_relationships")
            .delete()
            .eq("id", rel.id);

          if (deleteRelError) {
            throw deleteRelError;
          }
        } else {
          const { error: updateRelError } = await supabaseAdmin
            .from("recipe_relationships")
            .update({
              parent_recipe_id: newParent,
              child_recipe_id: newChild
            })
            .eq("id", rel.id);

          if (updateRelError) {
            throw updateRelError;
          }
        }
      }
    }

    // 3. Marquer la recette dupliquée comme brouillon et modifier son slug
    const { data: duplicateRecipe, error: duplicateFetchError } =
      await supabaseAdmin
        .from("recipes")
        .select("id, slug, source_info")
        .eq("id", duplicateId)
        .single();

    if (duplicateFetchError) {
      throw duplicateFetchError;
    }

    if (duplicateRecipe) {
      const newSlug = `${duplicateRecipe.slug || duplicateId}-fusionnee`;
      const mergeNote = `[Fusion] Fusionnée dans la recette ${canonicalId} le ${new Date().toISOString()}`;

      const { error: updateDupError } = await supabaseAdmin
        .from("recipes")
        .update({
          slug: newSlug,
          status: "draft",
          source_info: duplicateRecipe.source_info
            ? `${duplicateRecipe.source_info}\n${mergeNote}`
            : mergeNote
        })
        .eq("id", duplicateId);

      if (updateDupError) {
        throw updateDupError;
      }
    }

    // 4. Mettre à jour l'alerte de similarité si fournie
    if (alertId) {
      const { error: alertError } = await supabaseAdmin
        .from("recipe_similarity_alerts")
        .update({
          status: "resolved",
          resolution: "merged"
        })
        .eq("id", alertId);

      if (alertError) {
        throw alertError;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("[recipes/merge] error", error);
    return NextResponse.json(
      {
        error: "Erreur lors de la fusion des recettes.",
        details: error?.message ?? String(error)
      },
      { status: 500 }
    );
  }
}