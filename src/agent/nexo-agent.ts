import { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { SYSTEM_PROMPT } from './prompts/system';
import {
  buscarCentralDeAjuda,
  listarMeusChamados,
  obterChamado,
  prepararRascunho,
  transferirParaAnalista,
  perguntarAoUsuario,
} from './tools';
import { AgentTurn, AgentTurnSchema } from './decision';
import { ToolCallTrace, labelForTool, summarize } from './trace';

// Mastra resolve o provider a partir do prefixo da string ("google/...",
// "anthropic/...") usando seu próprio roteador de modelos — não é preciso
// instanciar o SDK do provider manualmente. A chave de API correspondente
// (GOOGLE_GENERATIVE_AI_API_KEY ou ANTHROPIC_API_KEY) vem do .env.
// Modelo e provedor documentados no README (custo por conversa).
const LLM_MODEL = process.env.LLM_MODEL || 'anthropic/claude-3-5-haiku-20241022';

export const nexoAgent = new Agent({
  name: 'Nexo Assist',
  id: 'nexo-assist-agent',
  instructions: SYSTEM_PROMPT,
  model: LLM_MODEL,
  tools: {
    buscar_central_de_ajuda: buscarCentralDeAjuda,
    listar_meus_chamados: listarMeusChamados,
    obter_chamado: obterChamado,
    preparar_rascunho: prepararRascunho,
    transferir_para_analista: transferirParaAnalista,
    perguntar_ao_usuario: perguntarAoUsuario,
  },
});

export interface RunAgentResult {
  turn: AgentTurn;
  /** Trace das tool calls REAIS executadas nesse turno, na ordem em que ocorreram. */
  toolTrace: ToolCallTrace[];
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export async function runAgent(
  userMessage: string,
  context: {
    conversationId: number;
    userId: number;
    userEmail: string;
    userName: string;
    userDepartment: string;
    conversationState: string;
    recentMessages: Array<{ role: string; content: string }>;
    currentDate: string;
  }
): Promise<RunAgentResult | undefined> {
  const systemContext = `
Contexto atual:
- Usuário: ${context.userName} (${context.userEmail})
- Departamento: ${context.userDepartment}
- Data/hora: ${context.currentDate}
- Estado da conversa: ${context.conversationState}
- ID da conversa: ${context.conversationId}

Histórico recente (últimas 10 mensagens):
${context.recentMessages.map(m => `${m.role}: ${m.content}`).join('\n')}`;

  const requestContext = new RequestContext();
  requestContext.setRaw('userId', context.userId);
  requestContext.setRaw('conversationId', context.conversationId);

  const result = await nexoAgent.generate(
    [
      { role: 'system', content: systemContext },
      { role: 'user', content: userMessage },
    ],
    {
      requestContext,
      structuredOutput: { schema: AgentTurnSchema },
    }
  );

  if (!result.object) {
    return undefined;
  }

  // Validação/normalização em tempo de execução: o schema tem default() em
  // rulesApplied, o que faz o tipo inferido pelo generic do Mastra divergir
  // ligeiramente do AgentTurn "de saída". Reparseamos para ter o tipo
  // correto e, de quebra, uma garantia extra de que o shape é válido.
  const turn: AgentTurn = AgentTurnSchema.parse(result.object);

  // Monta o trace a partir das tool calls/results REAIS retornadas pelo
  // Mastra — não do texto que o modelo escreve. É isso que alimenta os
  // "chips de ação" na UI (requisito central do desafio: transparência).
  const toolResultsByCallId = new Map(
    (result.toolResults ?? []).map((tr: any) => [tr.payload?.toolCallId as string, tr.payload])
  );

  const toolTrace: ToolCallTrace[] = (result.toolCalls ?? []).map((call: any) => {
    const payload = call.payload ?? call;
    const resultPayload = toolResultsByCallId.get(payload.toolCallId);

    return {
      toolName: payload.toolName,
      label: labelForTool(payload.toolName),
      input: summarize(payload.args),
      output: summarize(resultPayload?.result),
    };
  });

  const usage = {
      inputTokens: (result.totalUsage as any)?.inputTokens ?? (result.usage as any)?.inputTokens ?? 0,
      outputTokens: (result.totalUsage as any)?.outputTokens ?? (result.usage as any)?.outputTokens ?? 0,
  };

  return {
    turn,
    toolTrace,
    usage,
  };
}
