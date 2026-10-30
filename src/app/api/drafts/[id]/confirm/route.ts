import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/services/auth/service';
import { db } from '@/db';
import { drafts, conversations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { ticketsClient } from '@/services/tickets/client';
import { conversationsService } from '@/services/conversations/service';
import { getClock } from '@/lib/clock';

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

    const draft = await db
      .select()
      .from(drafts)
      .where(and(eq(drafts.idempotencyKey, id), eq(drafts.conversationId, (await conversationsService.getOrCreateConversation(session.userId)).id)))
      .limit(1);

    if (!draft[0]) {
      return NextResponse.json({ error: 'Rascunho não encontrado' }, { status: 404 });
    }

    if (draft[0].status !== 'pendente') {
      return NextResponse.json({ error: 'Rascunho já foi processado' }, { status: 400 });
    }

    // `payload` é jsonb no schema (Drizzle não tipa colunas JSON automaticamente);
    // o shape real é o input validado por Zod em agent/tools/index.ts
    // (prepararRascunho) no momento em que o rascunho foi criado.
    const payload = draft[0].payload as any;
    const { tipo, titulo, descricao, tipoChamado, categoria, prioridade, chamadoId, numeroChamado } = payload;

    let ticketNumber: string;
    let ticketId: number;

    if (tipo === 'novo') {
      const result = await ticketsClient.create({
        title: titulo,
        description: descricao,
        type: tipoChamado!,
        category: categoria!,
        priority: prioridade!,
        requesterId: session.userId,
      }, id);

      ticketNumber = result.number;
      ticketId = result.id;
    } else if (tipo === 'atualizacao' || tipo === 'reabertura') {
      const targetId = chamadoId || (await ticketsClient.listByRequester(session.userId)).find(t => t.number === numeroChamado)?.id;
      if (!targetId) {
        return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 });
      }

      if (tipo === 'reabertura') {
        const result = await ticketsClient.reopen(targetId, session.userId);
        ticketNumber = result.number;
        ticketId = result.id;
      } else {
        const result = await ticketsClient.addNote(targetId, descricao, session.userId);
        ticketNumber = result.number;
        ticketId = result.id;
      }
    } else {
      return NextResponse.json({ error: 'Tipo de rascunho inválido' }, { status: 400 });
    }

    await db
      .update(drafts)
      .set({ status: 'confirmado', confirmedAt: getClock().now() })
      .where(eq(drafts.id, draft[0].id));

    await conversationsService.addMessage(draft[0].conversationId, {
      role: 'system',
      content: `Chamado ${ticketNumber} ${tipo === 'novo' ? 'criado' : tipo === 'reabertura' ? 'reaberto' : 'atualizado'} com sucesso.`,
      uiKind: 'ticket_card',
      uiData: { ticketNumber },
    });

    await db
      .update(conversations)
      .set({ currentTicketId: ticketId })
      .where(eq(conversations.id, draft[0].conversationId));

    return NextResponse.json({
      success: true,
      ticketNumber,
      message: `Chamado ${ticketNumber} ${tipo === 'novo' ? 'criado' : tipo === 'reabertura' ? 'reaberto' : 'atualizado'} com sucesso!`,
    });
  } catch (error) {
    console.error('Confirm draft error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao confirmar rascunho' },
      { status: 500 }
    );
  }
}