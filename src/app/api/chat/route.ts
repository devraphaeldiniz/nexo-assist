import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/services/auth/service';
import { conversationsService } from '@/services/conversations/service';
import { runAgent } from '@/agent/nexo-agent';
import { applyGuardrails } from '@/agent/guardrails';
import { estimateCostUsd } from '@/agent/cost';
import { getClock } from '@/lib/clock';
import { createLogger, generateTurnId } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const turnId = generateTurnId();
  const logger = createLogger({ turnId });

  try {
    const session = await getSessionFromCookie(request.headers.get('cookie') || '');
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { message } = await request.json();
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 });
    }

    if (message.length > 4000) {
      return NextResponse.json({ error: 'Mensagem muito longa' }, { status: 400 });
    }

    const conversation = await conversationsService.getOrCreateConversation(session.userId);
    const conversationId = conversation.id;

    // Conversa não está com o agent: registra a mensagem e NÃO chama o LLM.
    // Essa checagem é a primeira coisa que fazemos, antes de qualquer custo
    // de modelo, e cobre tanto 'aguardando_atendente' quanto 'com_analista'.
    if (conversation.state !== 'agent') {
      await conversationsService.addMessage(conversationId, {
        role: 'user',
        content: message,
      });

      const waitingMessage =
        conversation.state === 'com_analista'
          ? 'Sua mensagem foi enviada ao analista.'
          : 'Sua conversa está aguardando um analista. Sua mensagem foi registrada.';

      return NextResponse.json({
        message: waitingMessage,
        state: conversation.state,
        turnId,
        messageCount: conversation.messageCount + 1,
      });
    }

    if (conversation.messageCount >= 30) {
      await conversationsService.addMessage(conversationId, {
        role: 'user',
        content: message,
      });

      return NextResponse.json({
        message: 'Esta sessão atingiu o limite de 30 mensagens. Você pode iniciar uma nova sessão ou falar com um analista.',
        ui: {
          kind: 'options',
          question: 'Limite de mensagens atingido. O que deseja fazer?',
          options: ['Iniciar nova sessão', 'Falar com analista'],
        },
        decision: {
          intent: 'outro',
          understood: 'Usuário atingiu limite de 30 mensagens na sessão',
          action: 'Oferecer nova sessão ou analista',
          confidence: 1,
          reasoning: 'Limite de mensagens por sessão atingido',
          rulesApplied: ['Limite de 30 mensagens por sessão'],
        },
        state: conversation.state,
        turnId,
      });
    }

    await conversationsService.addMessage(conversationId, {
      role: 'user',
      content: message,
    });

    const recentMessages = await conversationsService.getMessages(conversationId, 10);
    const formattedMessages = recentMessages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : m.role,
      content: m.content,
    }));

    const currentDate = getClock().now().toISOString();
    const conversationDetails = await conversationsService.getConversationById(conversationId);

    const agentResult = await runAgent(message.trim(), {
      conversationId,
      userId: session.userId,
      userEmail: session.email,
      userName: conversationDetails?.userName || session.email,
      userDepartment: conversationDetails?.userDepartment || '',
      conversationState: conversation.state,
      recentMessages: formattedMessages,
      currentDate,
    });

    if (!agentResult) {
      logger.error('Agent returned undefined result', { conversationId, userId: session.userId });
      return NextResponse.json(
        { error: 'O agent não conseguiu gerar uma resposta válida. Tente reformular sua mensagem.', turnId },
        { status: 502 }
      );
    }

    const { turn: agentTurn, toolTrace, usage } = agentResult;

    const guardrailResult = applyGuardrails(agentTurn, {
      conversationState: conversation.state,
      hasConfirmation: false,
      isWritingAction: ['abrir_chamado', 'atualizar_chamado'].includes(agentTurn.decision.intent),
    });

    const finalTurn = guardrailResult.modifiedTurn || agentTurn;
    // Se um guardrail bloqueou a ação, o trace de tools ainda reflete o que
    // o agent realmente consultou antes de ser barrado (transparência).
    const modelName = process.env.LLM_MODEL || 'claude-3-5-haiku-20241022';
    const costUsd = estimateCostUsd(modelName, usage.inputTokens, usage.outputTokens);

    await conversationsService.addMessage(conversationId, {
      role: 'assistant',
      content: finalTurn.message,
      uiKind: finalTurn.ui?.kind,
      uiData: finalTurn.ui,
      decisionTrace: {
        decision: finalTurn.decision,
        toolCalls: toolTrace,
        model: modelName,
      },
      tokensIn: usage.inputTokens,
      tokensOut: usage.outputTokens,
      costUsd: costUsd.toFixed(6),
    });

    logger.info('Agent turn completed', {
      intent: finalTurn.decision.intent,
      confidence: finalTurn.decision.confidence,
      toolCallCount: toolTrace.length,
      conversationId,
      userId: session.userId,
    });

    return NextResponse.json({
      message: finalTurn.message,
      ui: finalTurn.ui,
      decision: finalTurn.decision,
      toolCalls: toolTrace,
      tokensIn: usage.inputTokens,
      tokensOut: usage.outputTokens,
      costUsd,
      state: conversation.state,
      turnId,
      messageCount: conversation.messageCount + 1,
    });
  } catch (error) {
    logger.error('Chat error', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Erro interno do servidor', turnId },
      { status: 500 }
    );
  }
}
