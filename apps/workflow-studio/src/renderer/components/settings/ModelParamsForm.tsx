import { useCallback } from 'react';
import type { ProviderModelParams } from '../../../shared/types/settings';
import { MODEL_CONTEXT_WINDOW } from '../../../shared/types/settings';

interface ModelParamsFormProps {
  params: ProviderModelParams;
  selectedModel: string;
  onChange: (params: ProviderModelParams) => void;
}

function formatContextWindow(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M tokens`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K tokens`;
  return `${tokens} tokens`;
}

export default function ModelParamsForm({ params, selectedModel, onChange }: ModelParamsFormProps): JSX.Element {
  const temperature = params.temperature ?? 0.7;
  const maxTokens = params.maxTokens ?? 4096;
  const contextWindow = MODEL_CONTEXT_WINDOW[selectedModel];

  const handleTemperatureSlider = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Math.min(1, Math.max(0, parseFloat(e.target.value)));
      onChange({ ...params, temperature: val });
    },
    [params, onChange],
  );

  const handleTemperatureInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val)) {
        onChange({ ...params, temperature: Math.min(1, Math.max(0, val)) });
      }
    },
    [params, onChange],
  );

  const handleMaxTokens = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10);
      if (!isNaN(val)) {
        onChange({ ...params, maxTokens: Math.min(200_000, Math.max(1, val)) });
      }
    },
    [params, onChange],
  );

  return (
    <div className="space-y-3 mt-3">
      {/* Temperature */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Temperature</label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={temperature}
            onChange={handleTemperatureSlider}
            className="flex-1 h-1.5 accent-blue-500"
          />
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={temperature}
            onChange={handleTemperatureInput}
            className="w-16 text-xs bg-gray-900 text-gray-200 border border-gray-600 rounded px-2 py-1 text-center font-mono"
          />
        </div>
      </div>

      {/* Max Tokens */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Max Tokens</label>
        <input
          type="number"
          min={1}
          max={200000}
          value={maxTokens}
          onChange={handleMaxTokens}
          className="w-32 text-xs bg-gray-900 text-gray-200 border border-gray-600 rounded px-2 py-1 font-mono"
        />
      </div>

      {/* Context Window (read-only) */}
      {contextWindow != null && (
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Context Window</label>
          <span className="inline-block text-xs bg-gray-700 text-gray-300 rounded-full px-2.5 py-0.5">
            {formatContextWindow(contextWindow)}
          </span>
        </div>
      )}
    </div>
  );
}
