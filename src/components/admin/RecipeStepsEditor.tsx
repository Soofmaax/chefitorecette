"use client";

import React, {
  useEffect,
  useState,
  useImperativeHandle
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { parseInstructionsToSteps } from "@/lib/recipeImport";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { StepEditor, StepData } from "./StepEditor";

interface DbStep {
  id: string;
  step_number: number;
  title: string | null;
  instruction: string | null;
  estimated_duration: number | null;
  temperature_celsius: number | null;
  difficulty_level: number | null;
  scientific_explanation: string | null;
}

interface RecipeStepsEditorProps {
  recipeId: string;
}

export interface RecipeStepsEditorHandle {
  prefillFromRecipeText: () => void;
}

const fetchSteps = async (recipeId: string): Promise<StepData[]> => {
  const { data, error } = await supabase
    .from("recipe_steps_enhanced")
    .select(
      "id, step_number, title, instruction, estimated_duration, temperature_celsius, difficulty_level, scientific_explanation"
    )
    .eq("recipe_id", recipeId)
    .order("step_number", { ascending: true });

  if (error) {
    throw error;
  }

  const rows = (data as DbStep[]) ?? [];

  return rows.map((row, index) => ({
    id: row.id,
    step_number: row.step_number ?? index + 1,
    title: row.title ?? "",
    instruction: row.instruction ?? "",
    estimated_duration:
      typeof row.estimated_duration === "number"
        ? String(row.estimated_duration)
        : "",
    temperature_celsius:
      typeof row.temperature_celsius === "number"
        ? String(row.temperature_celsius)
        : "",
    difficulty_level:
      typeof row.difficulty_level === "number"
        ? String(row.difficulty_level)
        : "",
    scientific_explanation: row.scientific_explanation ?? ""
  }));
};

export const RecipeStepsEditor = React.forwardRef<
  RecipeStepsEditorHandle,
  RecipeStepsEditorProps
>(({ recipeId }, ref) => {
  const queryClient = useQueryClient();
  const {
    data: steps,
    isLoading,
    isError
  } = useQuery<StepData[]>({
    queryKey: ["recipe-steps-enhanced", recipeId],
    queryFn: () => fetchSteps(recipeId)
  });

  const [localSteps, setLocalSteps] = useState<StepData[]>([]);
  const [prefillError, setPrefillError] = useState<string | null>(null);

  useEffect(() => {
    if (steps) {
      setLocalSteps(steps);
    }
  }, [steps]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const current = localSteps;

      // Supprimer toutes les étapes existantes puis réinsérer les actuelles
      const { error: deleteError } = await supabase
        .from("recipe_steps_enhanced")
        .delete()
        .eq("recipe_id", recipeId);

      if (deleteError) {
        throw deleteError;
      }

      if (current.length === 0) {
        return;
      }

      const insertPayload = current.map((step, index) => ({
        recipe_id: recipeId,
        step_number: index + 1,
        title: step.title || null,
        instruction: step.instruction || null,
        estimated_duration: step.estimated_duration
          ? Number(step.estimated_duration)
          : null,
        temperature_celsius: step.temperature_celsius
          ? Number(step.temperature_celsius)
          : null,
        difficulty_level: step.difficulty_level
          ? Number(step.difficulty_level)
          : null,
        scientific_explanation: step.scientific_explanation || null
      }));

      const { error: insertError } = await supabase
        .from("recipe_steps_enhanced")
        .insert(insertPayload);

      if (insertError) {
        throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["recipe-steps-enhanced", recipeId]
      });
    }
  });

  const addStep = () => {
    setLocalSteps((prev) => [
      ...prev,
      {
        step_number: prev.length + 1,
        title: "",
        instruction: "",
        estimated_duration: "",
        temperature_celsius: "",
        difficulty_level: "",
        scientific_explanation: ""
      }
    ]);
  };

  const updateStep = (index: number, value: StepData) => {
    setLocalSteps((prev) =>
      prev.map((step, i) => (i === index ? value : step))
    );
  };

  const removeStep = (index: number) => {
    setLocalSteps((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((step, idx) => ({ ...step, step_number: idx + 1 }))
    );
  };

  const moveStepUp = (index: number) => {
    if (index === 0) return;
    setLocalSteps((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(index - 1, 0, moved);
      return next.map((step, idx) => ({
        ...step,
        step_number: idx + 1
      }));
    });
  };

  const moveStepDown = (index: number) => {
    setLocalSteps((prev) => {
      if (index === prev.length - 1) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(index + 1, 0, moved);
      return next.map((step, idx) => ({
        ...step,
        step_number: idx + 1
      }));
    });
  };

  const prefillFromRecipeText = async () => {
    setPrefillError(null);

    try {
      const { data, error } = await supabase
        .from("recipes")
        .select("instructions_detailed")
        .eq("id", recipeId)
        .single();

      if (error) {
        throw error;
      }

      const instructions =
        (data as { instructions_detailed: string | null })
          .instructions_detailed;

      if (!instructions || instructions.trim() === "") {
        setPrefillError(
          "Aucun texte d'instructions détaillées n'est défini pour cette recette."
        );
        return;
      }

      const parsed = parseInstructionsToSteps(instructions);

      if (parsed.length === 0) {
        setPrefillError(
          "Impossible de découper les instructions en étapes. Vérifie le format du texte."
        );
        return;
      }

      const nextSteps: StepData[] = parsed.map((item, index) => ({
        step_number: index + 1,
        title: "",
        instruction: item.instruction,
        estimated_duration: "",
        temperature_celsius: "",
        difficulty_level: "",
        scientific_explanation: ""
      }));

      setLocalSteps(nextSteps);
    } catch (_err) {
      setPrefillError(
        "Erreur lors de la récupération ou de l'analyse des instructions."
      );
    }
  };

  useImperativeHandle(ref, () => ({
    prefillFromRecipeText
  }));

  if (isError) {
    return (
      <p className="text-xs text-red-300">
        Impossible de charger les étapes enrichies.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            Étapes enrichies
          </h3>
          {prefillError && (
            <p className="mt-1 text-[11px] text-red-300">{prefillError}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            className="text-xs"
            onClick={prefillFromRecipeText}
          >
            Pré-remplir depuis le texte
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="text-xs"
            onClick={addStep}
          >
            Ajouter une étape
          </Button>
          <Button
            type="button"
            variant="primary"
            className="inline-flex items-center gap-2 text-xs"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending && (
              <LoadingSpinner size="sm" className="text-slate-100" />
            )}
            <span>Enregistrer les étapes</span>
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-slate-500">
        Ces étapes détaillées alimentent la table{" "}
        <code className="rounded bg-slate-800/80 px-1">
          recipe_steps_enhanced
        </code>{" "}
        (titre, instruction riche, durée, température, explication).
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-slate-400">
          <LoadingSpinner className="mr-2" />
          Chargement des étapes…
        </div>
      ) : localSteps.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-700 px-4 py-4 text-[11px] text-slate-400">
          Aucune étape enrichie pour cette recette. Ajoutez une première étape
          pour détailler la méthode.
        </div>
      ) : (
        <div className="space-y-3">
          {localSteps.map((step, index) => (
            <StepEditor
              key={step.id ?? `step-${index}`}
              value={step}
              onChange={(val) => updateStep(index, val)}
              onRemove={() => removeStep(index)}
              onMoveUp={() => moveStepUp(index)}
              onMoveDown={() => moveStepDown(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
});

RecipeStepsEditor.displayName = "RecipeStepsEditor";