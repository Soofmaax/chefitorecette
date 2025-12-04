import React, { useState, KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

interface TagInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export const TagInput: React.FC<TagInputProps> = ({
  value,
  onChange,
  placeholder
}) => {
  const [inputValue, setInputValue] = useState("");

  const addTag = (tag: string) => {
    const cleaned = tag.trim();
    if (!cleaned) return;
    if (value.includes(cleaned)) return;
    onChange([...value, cleaned]);
    setInputValue("");
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(inputValue);
    } else if (event.key === "Backspace" && !inputValue && value.length) {
      removeTag(value[value.length - 1]);
    }
  };

  return (
    <div
      className={cn(
        "flex min-h-[42px] w-full flex-wrap items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm focus-within:ring-2 focus-within:ring-primary-500"
      )}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-100"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="text-slate-400 hover:text-slate-200"
          >
            ×
          </button>
        </span>
      ))}
      <input
        className="flex-1 border-none bg-transparent px-1 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? "Ajouter et valider avec Entrée"}
      />
    </div>
  );
};