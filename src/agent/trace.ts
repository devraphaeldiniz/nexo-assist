import { z } from 'zod';

/**
 * Rótulos legíveis para cada tool, usados nos "chips de ação" da UI.
 * Mantido separado do agent.ts para não acoplar apresentação ao core do agent.
 */
const TOOL_LABELS: Record<string, string> = {
  buscar_central_de_ajuda: 'buscou na central de ajuda',
  listar_meus_chamados: 'consultou seus chamados',
  obter_chamado: 'consultou o chamado',
  preparar_rascunho: 'montou o rascunho',
  transferir_para_analista: 'transferiu para um analista',
  perguntar_ao_usuario: 'fez uma pergunta',
};

export const ToolCallTraceSchema = z.object({
  toolName: z.string(),
  label: z.string(),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
});

export type ToolCallTrace = z.infer<typeof ToolCallTraceSchema>;

export function labelForTool(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName;
}

/**
 * Resumo raso de um objeto para não persistir payloads grandes (ex.: artigos
 * inteiros da central de ajuda) no trace exibido na UI.
 */
export function summarize(value: unknown, maxLen = 300): unknown {
  if (value === null || value === undefined) return value;
  const json = JSON.stringify(value);
  if (json.length <= maxLen) {
    try {
      return JSON.parse(json);
    } catch {
      return json;
    }
  }
  return `${json.slice(0, maxLen)}…`;
}
