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
    const { content } = await request.json();

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 });
    }

    const conversation = await conversationsService.getConversationById(conversationId);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 });
    }

    if (conversation.state !== 'com_analista' || conversation.analystId !== session.userId) {
      return NextResponse.json({ error: 'Você não está atendendo esta conversa' }, { status: 400 });
    }

    await conversationsService.addMessage(conversationId, {
      role: 'analyst',
      content: content.trim(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Send analyst message error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao enviar mensagem' }, { status: 500 });
  }
}