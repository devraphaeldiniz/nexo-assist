import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/services/auth/service';
import { conversationsService } from '@/services/conversations/service';
import { ensureDb } from '@/lib/ensure-db';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDb();
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

    if (conversation.state !== 'aguardando_atendente') {
      return NextResponse.json({ error: 'Conversa não está aguardando atendente' }, { status: 400 });
    }

    await conversationsService.transitionConversation(conversationId, 'com_analista', session.userId, {
      analystId: session.userId,
    });

    await conversationsService.addMessage(conversationId, {
      role: 'system',
      content: `${session.name} assumiu o atendimento. O agent foi pausado.`,
      uiKind: 'options',
      uiData: { question: 'Atendimento assumido', options: ['Continuar'] },
    });

    return NextResponse.json({ success: true, message: 'Atendimento assumido com sucesso' });
  } catch (error) {
    console.error('Assume conversation error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao assumir atendimento' }, { status: 500 });
  }
}