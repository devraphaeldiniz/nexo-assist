import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/services/auth/service';
import { conversationsService } from '@/services/conversations/service';
import { runAgent } from '@/agent/nexo-agent';
import { applyGuardrails } from '@/agent/guardrails';
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

    if (conversation.state !== 'agent') {
      await conversationsService.addMessage(conversationId, {
        role: 'user',
        content: message,
      });

      return NextResponse.json({
        message: 'Sua conversa está com um analista. Por favor, aguarde.',
        ui: { kind: 'options', question: 'Aguardando analista...', options: ['OK'] },
        decision: {
          intent: 'outro',
          understood: 'Usuário enviou mensagem mas conversa está com analista',
          action: 'Mensagem registrada, agent pausado',
          confidence: 1,
          reasoning: 'Estado da conversa não permite atuação do agent',
          rulesApplied: ['Agent pausado durante atendimento humano'],
        },
        turnId,
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

    const agentResult = await runAgent(message.trim(), {
      conversationId,
      userId: session.userId,
      userEmail: session.email,
      userName: (await conversationsService.getConversationById(conversationId))?.userName || session.email,
      userDepartment: (await conversationsService.getConversationById(conversationId))?.userDepartment || '',
      conversationState: conversation.state,
      recentMessages: formattedMessages,
      currentDate,
    });

    if (!agentResult) {
      logger.error('Agent returned undefined result', { conversationId, userId: session.userId });
      return NextResponse.json(
        { error: 'Erro ao processar resposta do agente', turnId },
        { status: 500 }
      );
    }

    const guardrailResult = applyGuardrails(agentResult, {
      conversationState: conversation.state,
      hasConfirmation: false,
      isWritingAction: ['abrir_chamado', 'atualizar_chamado'].includes(agentResult.decision.intent),
    });

    const finalTurn = guardrailResult.modifiedTurn || agentResult;

    await conversationsService.addMessage(conversationId, {
      role: 'assistant',
      content: finalTurn.message,
      uiKind: finalTurn.ui?.kind,
      uiData: finalTurn.ui ? { ...finalTurn.ui, kind: undefined } : undefined,
      decisionTrace: finalTurn.decision,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: '0.00',
    });

    logger.info('Agent turn completed', {
      intent: finalTurn.decision.intent,
      confidence: finalTurn.decision.confidence,
      conversationId,
      userId: session.userId,
    });

    return NextResponse.json({
      message: finalTurn.message,
      ui: finalTurn.ui,
      decision: finalTurn.decision,
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