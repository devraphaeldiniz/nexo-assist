import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/services/auth/service';
import { conversationsService } from '@/services/conversations/service';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request.headers.get('cookie') || '');
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const conversation = await conversationsService.getOrCreateConversation(session.userId);
    const messages = await conversationsService.getMessages(conversation.id, 50);

    return NextResponse.json({
      conversationId: conversation.id,
      messages,
      messageCount: conversation.messageCount,
      state: conversation.state,
    });
  } catch (error) {
    console.error('Chat history error:', error);
    return NextResponse.json({ error: 'Erro ao carregar histórico' }, { status: 500 });
  }
}