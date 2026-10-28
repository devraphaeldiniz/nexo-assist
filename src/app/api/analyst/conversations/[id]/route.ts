import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/services/auth/service';
import { conversationsService } from '@/services/conversations/service';
import { ticketsClient } from '@/services/tickets/client';

export const runtime = 'nodejs';

export async function GET(
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

    const messages = await conversationsService.getMessages(conversationId, 100);

    let userTickets: any[] = [];
    if (conversation.userId) {
      userTickets = await ticketsClient.listByRequester(conversation.userId);
    }

    return NextResponse.json({
      conversation,
      messages,
      userTickets,
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    return NextResponse.json({ error: 'Erro ao buscar conversa' }, { status: 500 });
  }
}