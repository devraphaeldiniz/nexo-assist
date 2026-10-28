import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/services/auth/service';
import { conversationsService } from '@/services/conversations/service';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request.headers.get('cookie') || '');
    if (!session || session.role !== 'analyst') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state') as any;
    const filter = searchParams.get('filter');

    let conversations;
    if (filter === 'minhas') {
      conversations = await conversationsService.listConversationsForAnalyst({
        analystId: session.userId,
      });
    } else if (filter === 'com_agent') {
      conversations = await conversationsService.listConversationsForAnalyst({
        state: 'agent',
      });
    } else if (filter === 'aguardando') {
      conversations = await conversationsService.listConversationsForAnalyst({
        state: 'aguardando_atendente',
      });
    } else if (filter === 'com_analista') {
      conversations = await conversationsService.listConversationsForAnalyst({
        state: 'com_analista',
      });
    } else {
      conversations = await conversationsService.listConversationsForAnalyst({
        state: state || undefined,
      });
    }

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('List conversations error:', error);
    return NextResponse.json({ error: 'Erro ao listar conversas' }, { status: 500 });
  }
}