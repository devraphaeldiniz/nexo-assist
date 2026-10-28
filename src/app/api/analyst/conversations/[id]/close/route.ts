import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/services/auth/service';
import { conversationsService } from '@/services/conversations/service';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromCookie(request.headers.get('cookie') || '');
    if (!session || session.role !== 'analyst') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const { id } = await params;
    const conversationId = parseInt(id, 10);

    const conversation = await conversationsService.getConversationById(conversationId);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 });
    }

    if (conversation.state !== 'com_analista' || conversation.analystId !== session.userId) {
      return NextResponse.json({ error: 'Você não está atendendo esta conversa' }, { status: 400 });
    }

    await conversationsService.transitionConversation(conversationId, 'encerrada', session.userId);

    await conversationsService.addMessage(conversationId, {
      role: 'system',
      content: `${session.name} encerrou o atendimento.`,
      uiKind: 'options',
      uiData: { question: 'Atendimento encerrado', options: ['OK'] },
    });

    return NextResponse.json({ success: true, message: 'Atendimento encerrado com sucesso' });
  } catch (error) {
    console.error('Close conversation error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao encerrar atendimento' }, { status: 500 });
  }
}