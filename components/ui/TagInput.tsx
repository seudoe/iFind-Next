"use client";

import { useState, KeyboardEvent } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  className?: string;
  suggestions?: string[];
}

export function TagInput({
  tags,
  onChange,
  placeholder = "Type and press Enter",
  label,
  error,
  className,
  suggestions = [],
}: TagInputProps) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filtered = suggestions.filter(
    (s) =>
      s.toLowerCase().includes(input.toLowerCase()) &&
      !tags.includes(s)
  );

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput("");
    setShowSuggestions(false);
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label className="text-sm font-medium text-gray-700">{label}</label>
      )}
      <div
        className={cn(
          "min-h-[42px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2",
          "flex flex-wrap gap-1.5 items-center",
          "focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent",
          error && "border-red-500"
        )}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:text-blue-900 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <div className="relative flex-1 min-w-[120px]">
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setShowSuggestions(true);
            }}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onFocus={() => input && setShowSuggestions(true)}
            placeholder={tags.length === 0 ? placeholder : ""}
            className="w-full text-sm outline-none bg-transparent placeholder:text-gray-400"
          />
          {showSuggestions && filtered.length > 0 && (
            <div className="absolute top-full left-0 z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white shadow-lg">
              {filtered.slice(0, 6).map((s) => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={() => addTag(s)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors first:rounded-t-lg last:rounded-b-lg"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
