import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/services/auth/service';
import { db } from '@/db';
import { drafts } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { conversationsService } from '@/services/conversations/service';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromCookie(request.headers.get('cookie') || '');
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { id } = await params;

    const conversation = await conversationsService.getOrCreateConversation(session.userId);

    const draft = await db
      .select()
      .from(drafts)
      .where(and(eq(drafts.idempotencyKey, id), eq(drafts.conversationId, conversation.id)))
      .limit(1);

    if (!draft[0]) {
      return NextResponse.json({ error: 'Rascunho não encontrado' }, { status: 404 });
    }

    if (draft[0].status !== 'pendente') {
      return NextResponse.json({ error: 'Rascunho já foi processado' }, { status: 400 });
    }

    await db
      .update(drafts)
      .set({ status: 'substituido' })
      .where(eq(drafts.id, draft[0].id));

    await conversationsService.addMessage(conversation.id, {
      role: 'system',
      content: 'Rascunho cancelado. Você pode dizer o que deseja alterar.',
    });

    return NextResponse.json({
      success: true,
      message: 'Rascunho cancelado. O que você gostaria de alterar?',
    });
  } catch (error) {
    console.error('Cancel draft error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao cancelar rascunho' },
      { status: 500 }
    );
  }
}