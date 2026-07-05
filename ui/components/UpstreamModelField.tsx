import { CUSTOM_MODEL_VALUE } from "../constants";
import type { ProviderModelsState } from "../types";
import { SearchableModelSelect } from "./SearchableModelSelect";

export function UpstreamModelField({
  providerId,
  upstreamModel,
  modelState,
  forceCustom,
  onReload,
  onChange,
  onCustomModeChange
}: {
  providerId: string;
  upstreamModel: string;
  modelState?: ProviderModelsState;
  forceCustom: boolean;
  onReload: () => void;
  onChange: (upstreamModel: string) => void;
  onCustomModeChange: (enabled: boolean) => void;
}) {
  if (!providerId) {
    return (
      <div className="model-field">
        <input disabled placeholder="Select a provider first" value="" readOnly />
      </div>
    );
  }

  const models = modelState?.models ?? [];
  const loading = modelState?.loading ?? false;
  const knownModel = upstreamModel && models.includes(upstreamModel);
  const showCustomInput = forceCustom || (!loading && upstreamModel !== "" && !knownModel);
  const selectValue = showCustomInput ? CUSTOM_MODEL_VALUE : upstreamModel;

  return (
    <div className="model-field">
      <div className="model-field-controls">
        <SearchableModelSelect
          value={selectValue}
          models={models}
          disabled={loading && models.length === 0}
          loading={loading}
          placeholder={loading ? "Loading models..." : "Search or select upstream model"}
          onSelect={(value) => {
            if (value === CUSTOM_MODEL_VALUE) {
              onCustomModeChange(true);
              if (knownModel) {
                onChange("");
              }
              return;
            }

            onCustomModeChange(false);
            onChange(value);
          }}
        />
        <button type="button" className="secondary model-reload" onClick={onReload} disabled={loading} title="Fetch upstream models and add missing IDs to the catalog">
          ↻
        </button>
      </div>
      {showCustomInput && (
        <input
          placeholder="Custom upstream model"
          value={upstreamModel}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {modelState?.error && <small className="model-hint">{modelState.error}</small>}
      {!loading && modelState?.source === "upstream" && !modelState.error && <small className="model-hint">Live list from provider API</small>}
      {!loading && modelState?.source === "cached" && !modelState.error && <small className="model-hint">Curated catalog</small>}
    </div>
  );
}
