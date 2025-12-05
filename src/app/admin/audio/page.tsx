"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { uploadAudioFile } from "@/lib/storage";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Button } from "@/components/ui/Button";

interface AudioLibraryRow {
  id: string;
  audio_key: string;
  audio_url: string;
  audio_type: string | null;
  language: string | null;
  voice_style: string | null;
  quality_tier: string | null;
  production_status: string | null;
  audio_duration_seconds: number | null;
}

interface AudioMappingRow {
  id: string;
  concept_key: string;
  content_type: string;
  audio_library_id: string;
}

const fetchAudioLibrary = async (): Promise<AudioLibraryRow[]> => {
  const { data, error } = await supabase
    .from("audio_library")
    .select(
      "id, audio_key, audio_url, audio_type, language, voice_style, quality_tier, production_status, audio_duration_seconds"
    )
    .order("audio_key", { ascending: true });

  if (error) {
    throw error;
  }

  return (data as AudioLibraryRow[]) ?? [];
};

const fetchAudioMappings = async (): Promise<AudioMappingRow[]> => {
  const { data, error } = await supabase
    .from("audio_mapping")
    .select("id, concept_key, content_type, audio_library_id")
    .order("concept_key", { ascending: true });

  if (error) {
    throw error;
  }

  return (data as AudioMappingRow[]) ?? [];
};

const AdminAudioPage = () => {
  const queryClient = useQueryClient();

  const {
    data: audio,
    isLoading,
    isError
  } = useQuery<AudioLibraryRow[]>({
    queryKey: ["audio-library"],
    queryFn: fetchAudioLibrary,
    staleTime: 10 * 60 * 1000
  });

  const {
    data: mappings,
    isLoading: mappingsLoading,
    isError: mappingsError
  } = useQuery<AudioMappingRow[]>({
    queryKey: ["audio-mapping"],
    queryFn: fetchAudioMappings,
    staleTime: 10 * 60 * 1000
  });

  const [file, setFile] = useState<File | null>(null);
  const [audioKey, setAudioKey] = useState("");
  const [audioType, setAudioType] = useState("concept");
  const [language, setLanguage] = useState("fr");
  const [voiceStyle, setVoiceStyle] = useState("");
  const [qualityTier, setQualityTier] = useState("standard");

  const [mappingConceptKey, setMappingConceptKey] = useState("");
  const [mappingContentType, setMappingContentType] = useState("ingredient");
  const [mappingAudioId, setMappingAudioId] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const fileToUpload = file;
      const key = audioKey.trim();

      if (!fileToUpload || !key) {
        throw new Error("Fichier audio et clé audio requis.");
      }

      // 1. Upload dans Supabase Storage
      const url = await uploadAudioFile(fileToUpload, key);

      // 2. Créer l'entrée dans audio_library
      const { error } = await supabase.from("audio_library").insert([
        {
          audio_key: key,
          audio_url: url,
          audio_type: audioType || null,
          language: language || null,
          voice_style: voiceStyle || null,
          quality_tier: qualityTier || null,
          production_status: "ready"
        }
      ]);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      setFile(null);
      setAudioKey("");
      setVoiceStyle("");
      setUploadError(null);
      queryClient.invalidateQueries({ queryKey: ["audio-library"] });
    },
    onError: (err: any) => {
      // eslint-disable-next-line no-console
      console.error(err);
      setUploadError(
        err?.message ?? "Erreur lors de l'upload du fichier audio."
      );
    }
  });

  const mappingMutation = useMutation({
    mutationFn: async () => {
      if (!mappingConceptKey.trim() || !mappingAudioId) {
        throw new Error("Clé de concept et audio requis.");
      }

      const { error } = await supabase.from("audio_mapping").insert([
        {
          concept_key: mappingConceptKey.trim(),
          content_type: mappingContentType,
          audio_library_id: mappingAudioId
        }
      ]);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      setMappingConceptKey("");
      setMappingAudioId("");
      queryClient.invalidateQueries({ queryKey: ["audio-mapping"] });
    }
  });

  if (isError) {
    return (
      <p className="text-sm text-red-300">
        Impossible de charger la bibliothèque audio.
      </p>
    );
  }

  if (mappingsError) {
    return (
      <p className="text-sm text-red-300">
        Impossible de charger les mappings audio.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-50">
          Gestion audio
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Visualisez les fichiers audio disponibles (actions, concepts,
          introductions, astuces…) et leur statut de production.
        </p>
      </div>

      {/* Bloc upload audio */}
      <div className="card space-y-4 px-4 py-4">
        <h2 className="text-sm font-semibold text-slate-100">
          Upload d&apos;un nouveau fichier audio
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="audio_file">Fichier audio</label>
            <input
              id="audio_file"
              type="file"
              accept="audio/*"
              className="mt-1 w-full text-sm text-slate-200 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-100 hover:file:bg-slate-700"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
              }}
            />
          </div>
          <div>
            <label htmlFor="audio_key">Clé audio</label>
            <input
              id="audio_key"
              type="text"
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="ex: intro_tarte_pommes"
              value={audioKey}
              onChange={(e) => setAudioKey(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Utilisé comme identifiant fonctionnel (recette, concept,
              ingrédient…).
            </p>
          </div>
          <div>
            <label htmlFor="audio_type">Type</label>
            <select
              id="audio_type"
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
              value={audioType}
              onChange={(e) => setAudioType(e.target.value)}
            >
              <option value="concept">Concept</option>
              <option value="ingredient">Ingrédient</option>
              <option value="action">Action</option>
              <option value="intro">Introduction</option>
              <option value="tip">Astuce</option>
              <option value="">Autre</option>
            </select>
          </div>

          <div>
            <label htmlFor="language">Langue</label>
            <input
              id="language"
              type="text"
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="voice_style">Voix</label>
            <input
              id="voice_style"
              type="text"
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="chef, neutre, narrateur…"
              value={voiceStyle}
              onChange={(e) => setVoiceStyle(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="quality_tier">Qualité</label>
            <input
              id="quality_tier"
              type="text"
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="standard, premium…"
              value={qualityTier}
              onChange={(e) => setQualityTier(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="primary"
            className="inline-flex items-center gap-2 text-xs"
            disabled={uploadMutation.isPending}
            onClick={() => uploadMutation.mutate()}
          >
            {uploadMutation.isPending && (
              <LoadingSpinner size="sm" className="text-slate-100" />
            )}
            <span>Uploader et créer l&apos;entrée audio</span>
          </Button>
          {uploadError && (
            <p className="text-[11px] text-red-300">{uploadError}</p>
          )}
        </div>
      </div>

      {/* Tableau audio */}
      <div className="card overflow-hidden">
        <div className="border-b border-slate-800 px-4 py-3 text-xs text-slate-400">
          {isLoading
            ? "Chargement de la bibliothèque audio…"
            : `${audio?.length ?? 0} entrée(s) audio.`}
        </div>

        <div className="max-h-[360px] overflow-auto text-sm">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-2 text-left">Clé</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Langue</th>
                <th className="px-4 py-2 text-left">Voix</th>
                <th className="px-4 py-2 text-left">Qualité</th>
                <th className="px-4 py-2 text-left">Production</th>
                <th className="px-4 py-2 text-right">Durée (s)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-slate-400"
                  >
                    <LoadingSpinner className="mr-2 inline-block" />
                    Chargement…
                  </td>
                </tr>
              ) : !audio || audio.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    Aucun fichier audio pour le moment.
                  </td>
                </tr>
              ) : (
                audio.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-2 align-top">
                      <div className="font-medium text-slate-100">
                        {row.audio_key}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {row.audio_url}
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-slate-400">
                      {row.audio_type || "—"}
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-slate-400">
                      {row.language || "—"}
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-slate-400">
                      {row.voice_style || "—"}
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-slate-400">
                      {row.quality_tier || "—"}
                    </td>
                    <td className="px-4 py-2 align-top text-xs text-slate-400">
                      {row.production_status || "—"}
                    </td>
                    <td className="px-4 py-2 align-top text-right text-xs text-slate-400">
                      {row.audio_duration_seconds ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mapping audio */}
      <div className="card space-y-4 px-4 py-4">
        <h2 className="text-sm font-semibold text-slate-100">
          Mapping audio ↔ ingrédients / concepts
        </h2>
        <p className="text-[11px] text-slate-500">
          Ces mappings permettent d&apos;associer un audio à une clé de contenu
          (ingrédient, concept scientifique, action...). Ils alimentent la table{" "}
          <code className="rounded bg-slate-800/80 px-1">audio_mapping</code>.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="mapping_concept_key">Clé de contenu</label>
            <input
              id="mapping_concept_key"
              type="text"
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="ex: ingredient:tomate, concept:maillard…"
              value={mappingConceptKey}
              onChange={(e) => setMappingConceptKey(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="mapping_content_type">Type</label>
            <select
              id="mapping_content_type"
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
              value={mappingContentType}
              onChange={(e) => setMappingContentType(e.target.value)}
            >
              <option value="ingredient">Ingrédient</option>
              <option value="concept">Concept</option>
              <option value="action">Action</option>
              <option value="step">Étape</option>
            </select>
          </div>
          <div>
            <label htmlFor="mapping_audio_id">Audio</label>
            <select
              id="mapping_audio_id"
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
              value={mappingAudioId}
              onChange={(e) => setMappingAudioId(e.target.value)}
            >
              <option value="">Sélectionnez un audio…</option>
              {audio?.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.audio_key}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <Button
            type="button"
            variant="primary"
            className="inline-flex items-center gap-2 text-xs"
            disabled={mappingMutation.isPending}
            onClick={() => mappingMutation.mutate()}
          >
            {mappingMutation.isPending && (
              <LoadingSpinner size="sm" className="text-slate-100" />
            )}
            <span>Créer le mapping</span>
          </Button>
        </div>

        <div className="max-h-[260px] overflow-auto rounded-md border border-slate-800 bg-slate-950/40 text-xs">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-900/80 text-[11px] uppercase text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left">Clé</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Audio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {mappingsLoading ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-3 py-4 text-center text-slate-400"
                  >
                    <LoadingSpinner className="mr-2 inline-block" />
                    Chargement des mappings…
                  </td>
                </tr>
              ) : !mappings || mappings.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-3 py-4 text-center text-slate-500"
                  >
                    Aucun mapping pour le moment.
                  </td>
                </tr>
              ) : (
                mappings.map((m) => {
                  const audioRow = audio?.find(
                    (row) => row.id === m.audio_library_id
                  );
                  return (
                    <tr key={m.id}>
                      <td className="px-3 py-2 align-top text-slate-100">
                        {m.concept_key}
                      </td>
                      <td className="px-3 py-2 align-top text-slate-400">
                        {m.content_type}
                      </td>
                      <td className="px-3 py-2 align-top text-slate-400">
                        {audioRow ? audioRow.audio_key : m.audio_library_id}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminAudioPage;