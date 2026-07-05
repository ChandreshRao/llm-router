import { useEffect, useMemo, useRef, useState } from "react";
import { CUSTOM_MODEL_VALUE } from "../constants";

export function SearchableModelSelect({
  value,
  models,
  placeholder,
  disabled,
  loading,
  onSelect
}: {
  value: string;
  models: string[];
  placeholder: string;
  disabled?: boolean;
  loading?: boolean;
  onSelect: (value: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedLabel =
    value === CUSTOM_MODEL_VALUE ? "Other (type manually)..." : value || (loading ? "Loading models..." : "");

  const filteredModels = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return models;
    }

    return models.filter((model) => model.toLowerCase().includes(normalized));
  }, [models, query]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  function choose(nextValue: string) {
    onSelect(nextValue);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={rootRef} className={`searchable-select${open ? " open" : ""}${disabled ? " disabled" : ""}`}>
      <button
        type="button"
        className="searchable-select-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (disabled) {
            return;
          }

          setOpen((current) => !current);
          setQuery("");
        }}
      >
        <span className={selectedLabel ? "" : "placeholder"}>{selectedLabel || placeholder}</span>
        <span className="searchable-select-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div className="searchable-select-menu" role="listbox">
          <input
            ref={inputRef}
            className="searchable-select-search"
            value={query}
            placeholder="Type to filter models..."
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                setQuery("");
              }
            }}
          />
          <div className="searchable-select-options">
            {!loading && filteredModels.length === 0 && <p className="hint searchable-select-empty">No models match your search.</p>}
            {filteredModels.map((model) => (
              <button
                key={model}
                type="button"
                role="option"
                aria-selected={value === model}
                className={value === model ? "selected" : ""}
                onClick={() => choose(model)}
              >
                {model}
              </button>
            ))}
            <button
              type="button"
              role="option"
              aria-selected={value === CUSTOM_MODEL_VALUE}
              className={`searchable-select-custom${value === CUSTOM_MODEL_VALUE ? " selected" : ""}`}
              onClick={() => choose(CUSTOM_MODEL_VALUE)}
            >
              Other (type manually)...
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
