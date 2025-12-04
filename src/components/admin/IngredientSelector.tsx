"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface IngredientOption {
  id: string;
  display_name: string;
  canonical_name: string;
  category: string;
}

export interface IngredientSelectorValue {
  id: string;
  label: string;
}

interface IngredientSelectorProps {
  value: IngredientSelectorValue | null;
  onChange: (value: IngredientSelectorValue | null) => void;
  placeholder?: string;
}

export const IngredientSelector: React.FC<IngredientSelectorProps> = ({
  value,
  onChange,
  placeholder
}) => {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<IngredientOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const fetchOptions = async () => {
      if (!query || query.trim().length < 2) {
        setOptions([]);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from("ingredients_catalog")
        .select("id, display_name, canonical_name, category")
        .ilike("display_name", `%${query.trim()}%`)
        .order("display_name", { ascending: true })
        .limit(20);

      if (!active) return;

      if (!error && data) {
        setOptions(data as IngredientOption[]);
      } else {
        setOptions([]);
      }
      setLoading(false);
    };

    const timeout = setTimeout(fetchOptions, 250);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [query]);

  const handleSelect = (option: IngredientOption) => {
    onChange({
      id: option.id,
      label: option.display_name
    });
    setOpen(false);
  };

  const label = value?.label ?? "";

  return (
    <div className="relative">
      <input
        type="text"
        className={cn(
          "w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
        )}
        placeholder={placeholder ?? "Rechercher un ingrédient…"}
        value={open ? query : label}
        onFocus={() => {
          setOpen(true);
          setQuery(label);
        }}
        onChange={(e) => {
          setOpen(true);
          setQuery(e.target.value);
        }}
        onBlur={() => {
          // On laisse un léger délai pour permettre le clic sur une option
          setTimeout(() => {
            setOpen(false);
            setQuery("");
          }, 120);
        }}
      />
      {open && (query.trim().length >= 2 || loading) && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-700 bg-slate-900 text-xs shadow-lg">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-3 py-2 text-slate-400">
              <LoadingSpinner size="sm" />
              <span>Recherche…</span>
            </div>
          ) : options.length === 0 ? (
            <div className="px-3 py-2 text-slate-500">
              Aucun ingrédient trouvé pour &laquo; {query.trim()} &raquo;.
            </div>
          ) : (
            options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="flex w-full flex-col items-start px-3 py-1.5 text-left text-slate-100 hover:bg-slate-800"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(opt);
                }}
              >
                <span>{opt.display_name}</span>
                <span className="text-[11px] text-slate-500">
                  {opt.canonical_name} • {opt.category}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};