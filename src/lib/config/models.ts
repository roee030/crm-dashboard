/**
 * Single source of truth for every external model / version id.
 * Change a provider model here and nowhere else.
 */
export const MODELS = {
  assemblyai: {
    /**
     * AssemblyAI `speech_models` is a plural string[] ordered fallback list:
     * the API tries index 0, then falls back to the next. The singular
     * `speech_model` (and the "best"/"nano" aliases) is deprecated.
     * ⚠️ Confirm "assemblyai-stt-3-7" resolves in your account; if it 400s the
     * pipeline logs the rejected id and "universal-2" takes over automatically.
     */
    speechModels: ["assemblyai-stt-3-7", "universal-2"] as string[],
  },
  claude: {
    model: "claude-sonnet-4-6",
    maxTokens: 2048,
  },
} as const;
