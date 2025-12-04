"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

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

const AdminAudioPage = () => {
  const {
    data: audio,
    isLoading,
    isError
  } = useQuery<AudioLibraryRow[]>({
    queryKey: ["audio-library"],
    queryFn: fetchAudioLibrary
  });

  if (isError) {
    return (
      <p className="text-sm text-red-300">
        Impossible de charger la bibliothèque audio.
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

      <div className="card overflow-hidden">
        <div className="border-b border-slate-800 px-4 py-3 text-xs text-slate-400">
          {isLoading
            ? "Chargement de la bibliothèque audio…"
            : `${audio?.length ?? 0} entrée(s) audio.`}
        </div>

        <div className="max-h-[560px] overflow-auto text-sm">
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
    </div>
  );
};

export default AdminAudioPage;