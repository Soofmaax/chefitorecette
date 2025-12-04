"use client";

import React, { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { cn } from "@/lib/utils";

export interface StepData {
  id?: string;
  step_number: number;
  title: string;
  instruction: string; // HTML
  estimated_duration: string;
  temperature_celsius: string;
  difficulty_level: string;
  scientific_explanation: string;
}

interface StepEditorProps {
  value: StepData;
  onChange: (value: StepData) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export const StepEditor: React.FC<StepEditorProps> = ({
  value,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown
}) => {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value.instruction || "",
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (html !== value.instruction) {
        onChange({ ...value, instruction: html });
      }
    }
  });

  useEffect(() => {
    if (!editor) return;
    if (value.instruction !== editor.getHTML()) {
      editor.commands.setContent(value.instruction || "", false);
    }
  }, [value.instruction, editor]);

  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-3 text-xs">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="cursor-move select-none text-slate-500">☰</span>
          <span className="font-semibold text-slate-200">
            Étape {value.step_number}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-md border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800"
            onClick={onMoveUp}
          >
            ↑
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800"
            onClick={onMoveDown}
          >
            ↓
          </button>
          <button
            type="button"
            className="rounded-md border border-red-500/40 px-2 py-0.5 text-[11px] text-red-300 hover:bg-red-500/10"
            onClick={onRemove}
          >
            Supprimer
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="mb-1 block text-[11px] font-medium text-slate-300">
            Titre de l&apos;étape
          </label>
          <input
            type="text"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-300">
            Durée estimée (min)
          </label>
          <input
            type="number"
            min={0}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
            value={value.estimated_duration}
            onChange={(e) =>
              onChange({ ...value, estimated_duration: e.target.value })
            }
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-300">
            Température (°C)
          </label>
          <input
            type="number"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
            value={value.temperature_celsius}
            onChange={(e) =>
              onChange({ ...value, temperature_celsius: e.target.value })
            }
          />
        </div>
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-[11px] font-medium text-slate-300">
          Instruction détaillée (éditeur riche)
        </label>
        <div
          className={cn(
            "min-h-[120px] rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100",
            "prose prose-invert max-w-none"
          )}
        >
          {editor ? (
            <EditorContent editor={editor} />
          ) : (
            <div className="text-[11px] text-slate-500">Chargement…</div>
          )}
        </div>
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-[11px] font-medium text-slate-300">
          Explication scientifique / note pédagogique
        </label>
        <textarea
          rows={3}
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
          value={value.scientific_explanation}
          onChange={(e) =>
            onChange({ ...value, scientific_explanation: e.target.value })
          }
        />
      </div>
    </div>
  );
};