/**
 * Tabela de preços por milhão de tokens (USD), para estimar custo por turno.
 * Valores aproximados publicados pelos provedores em 2026; atualizar se o
 * modelo configurado mudar. Usado só para exibir custo estimado na UI
 * (painel "Ver decisão") e não para faturamento real.
 */
const PRICING_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4.0 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'gemini-3.8-flash': { input: 0.1, output: 0.4 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
};

const DEFAULT_PRICING = { input: 0.5, output: 2.0 };

export function estimateCostUsd(
  modelName: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = PRICING_PER_MILLION_TOKENS[modelName] ?? DEFAULT_PRICING;
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}
