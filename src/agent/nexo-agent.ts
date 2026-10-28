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
import { AgentTurn } from './decision';

const MODEL_NAME = process.env.LLM_MODEL || 'anthropic/claude-3-5-haiku-20241022';

export const nexoAgent = new Agent({
  name: 'Nexo Assist',
  id: 'nexo-assist-agent',
  instructions: SYSTEM_PROMPT,
  model: MODEL_NAME,
  tools: {
    buscar_central_de_ajuda: buscarCentralDeAjuda,
    listar_meus_chamados: listarMeusChamados,
    obter_chamado: obterChamado,
    preparar_rascunho: prepararRascunho,
    transferir_para_analista: transferirParaAnalista,
    perguntar_ao_usuario: perguntarAoUsuario,
  },
});

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
): Promise<AgentTurn | undefined> {
  const systemContext = `
Contexto atual:
- Usuário: ${context.userName} (${context.userEmail})
- Departamento: ${context.userDepartment}
- Data/hora: ${context.currentDate}
- Estado da conversa: ${context.conversationState}
- ID da conversa: ${context.conversationId}

Histórico recente (últimas 10 mensagens):
${context.recentMessages.map(m => `${m.role}: ${m.content}`).join('\n')}

Lembre-se: sua resposta DEVE ser um JSON válido conforme o schema.`;

  const requestContext = new RequestContext();
  requestContext.setRaw('userId', context.userId);
  requestContext.setRaw('conversationId', context.conversationId);

  const result = await nexoAgent.generate([
    { role: 'system', content: systemContext },
    { role: 'user', content: userMessage },
  ], {
    requestContext,
  });

  return result.object;
}