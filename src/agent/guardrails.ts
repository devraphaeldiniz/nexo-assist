import { AgentTurn, AgentDecision } from './decision';

const CONFIDENCE_THRESHOLD = parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.6');

export interface GuardrailResult {
  allowed: boolean;
  modifiedTurn?: AgentTurn;
  reason?: string;
}

export function applyGuardrails(turn: AgentTurn, context: {
  conversationState: string;
  hasConfirmation: boolean;
  isWritingAction: boolean;
}): GuardrailResult {
  const { decision } = turn;

  if (context.conversationState !== 'agent') {
    return {
      allowed: false,
      reason: 'Estado da conversa não permite atuação do agent',
      modifiedTurn: {
        message: 'Sua conversa está com um analista. Por favor, aguarde.',
        decision: {
          ...decision,
          intent: 'outro',
          action: 'Agent pausado - conversa com analista',
          confidence: 1,
          reasoning: 'Estado da conversa não permite atuação do agent',
          rulesApplied: ['Agent pausado durante atendimento humano'],
        },
      },
    };
  }

  if (decision.confidence < CONFIDENCE_THRESHOLD) {
    return {
      allowed: false,
      reason: `Confiança ${decision.confidence} abaixo do limiar ${CONFIDENCE_THRESHOLD}`,
      modifiedTurn: {
        message: 'Não tenho segurança suficiente para prosseguir. Vou transferir você para um analista.',
        ui: {
          kind: 'options',
          question: 'Transferindo para um analista...',
          options: ['OK'],
        },
        decision: {
          ...decision,
          intent: 'falar_com_analista',
          action: 'Transferência por baixa confiança',
          confidence: decision.confidence,
          reasoning: `Confiança ${(decision.confidence * 100).toFixed(0)}% abaixo do limiar de ${(CONFIDENCE_THRESHOLD * 100).toFixed(0)}%`,
          rulesApplied: ['Baixa confiança → transferência para analista'],
        },
      },
    };
  }

  const writingIntents = ['abrir_chamado', 'atualizar_chamado'];
  if (writingIntents.includes(decision.intent) && context.isWritingAction && !context.hasConfirmation) {
    return {
      allowed: false,
      reason: 'Ação de escrita sem confirmação do usuário',
      modifiedTurn: {
        message: 'Preciso da sua confirmação antes de criar ou atualizar o chamado.',
        // Preserva o `ui` (ex.: { kind: 'draft', draftId }) que o agent já montou
        // a partir do retorno de preparar_rascunho. Sem isso, o card de
        // confirmação nunca aparece e o usuário fica sem como confirmar —
        // justamente a ação que este guardrail existe para exigir confirmação.
        ui: turn.ui,
        decision: {
          ...decision,
          action: 'Aguardando confirmação do usuário',
          reasoning: 'Regra de negócio: criação/atualização de chamado requer confirmação explícita',
          rulesApplied: ['Confirmação obrigatória antes de escrita'],
        },
      },
    };
  }

  return { allowed: true };
}

export function validateDecision(decision: AgentDecision): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (decision.confidence < 0 || decision.confidence > 1) {
    errors.push('Confiança deve estar entre 0 e 1');
  }

  if (!decision.understood || decision.understood.length < 5) {
    errors.push('Campo "understood" deve ter pelo menos 5 caracteres');
  }

  if (!decision.action || decision.action.length < 5) {
    errors.push('Campo "action" deve ter pelo menos 5 caracteres');
  }

  if (!decision.reasoning || decision.reasoning.length < 10) {
    errors.push('Campo "reasoning" deve ter pelo menos 10 caracteres');
  }

  return { valid: errors.length === 0, errors };
}

export { CONFIDENCE_THRESHOLD };