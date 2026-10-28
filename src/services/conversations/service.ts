import { db } from '@/db';
import { conversations, messages, users, tickets } from '@/db/schema';
import { eq, and, desc, sql, or } from 'drizzle-orm';
import { getClock } from '@/lib/clock';
import { NotFoundError, ValidationError, StateTransitionError } from '@/lib/errors';

export type ConversationState = 'agent' | 'aguardando_atendente' | 'com_analista' | 'encerrada';

export interface ConversationWithDetails {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  userDepartment: string;
  state: ConversationState;
  analystId?: number;
  analystName?: string;
  currentTicketId?: number;
  currentTicketNumber?: string;
  messageCount: number;
  sessionStartedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageWithDecision {
  id: number;
  conversationId: number;
  role: 'user' | 'assistant' | 'system' | 'analyst';
  content: string;
  uiKind?: 'options' | 'ticket_selector' | 'ticket_card' | 'draft';
  uiData?: unknown;
  decisionTrace?: unknown;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: string;
  createdAt: Date;
}

export const VALID_TRANSITIONS: Record<ConversationState, ConversationState[]> = {
  agent: ['aguardando_atendente', 'encerrada'],
  aguardando_atendente: ['com_analista', 'agent', 'encerrada'],
  com_analista: ['agent', 'encerrada'],
  encerrada: [],
};

export function canTransition(from: ConversationState, to: ConversationState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

function mapConversationRow(row: any): ConversationWithDetails {
  return {
    id: row.id,
    userId: row.userId,
    userName: row.userName,
    userEmail: row.userEmail,
    userDepartment: row.userDepartment,
    state: row.state,
    analystId: row.analystId,
    analystName: row.analystName,
    currentTicketId: row.currentTicketId,
    currentTicketNumber: row.currentTicketNumber,
    messageCount: row.messageCount,
    sessionStartedAt: row.sessionStartedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getOrCreateConversation(userId: number): Promise<ConversationWithDetails> {
  const existing = await db
    .select({
      id: conversations.id,
      userId: conversations.userId,
      state: conversations.state,
      analystId: conversations.analystId,
      currentTicketId: conversations.currentTicketId,
      messageCount: conversations.messageCount,
      sessionStartedAt: conversations.sessionStartedAt,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
      userName: users.name,
      userEmail: users.email,
      userDepartment: users.department,
      analystName: sql<string>`(SELECT name FROM users WHERE id = ${conversations.analystId})`.as('analystName'),
      currentTicketNumber: sql<string>`(SELECT number FROM tickets WHERE id = ${conversations.currentTicketId})`.as('currentTicketNumber'),
    })
    .from(conversations)
    .leftJoin(users, eq(conversations.userId, users.id))
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.createdAt))
    .limit(1);

  if (existing[0]) {
    return mapConversationRow(existing[0]);
  }

  await db
    .insert(conversations)
    .values({
      userId,
      state: 'agent',
      messageCount: 0,
      sessionStartedAt: getClock().now(),
    });

  return getOrCreateConversation(userId);
}

export async function getConversationById(id: number): Promise<ConversationWithDetails | null> {
  const row = await db
    .select({
      id: conversations.id,
      userId: conversations.userId,
      state: conversations.state,
      analystId: conversations.analystId,
      currentTicketId: conversations.currentTicketId,
      messageCount: conversations.messageCount,
      sessionStartedAt: conversations.sessionStartedAt,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
      userName: users.name,
      userEmail: users.email,
      userDepartment: users.department,
      analystName: sql<string>`(SELECT name FROM users WHERE id = ${conversations.analystId})`.as('analystName'),
      currentTicketNumber: sql<string>`(SELECT number FROM tickets WHERE id = ${conversations.currentTicketId})`.as('currentTicketNumber'),
    })
    .from(conversations)
    .leftJoin(users, eq(conversations.userId, users.id))
    .where(eq(conversations.id, id))
    .limit(1);

  return row[0] ? mapConversationRow(row[0]) : null;
}

export async function listConversationsForAnalyst(filters?: {
  state?: ConversationState;
  analystId?: number;
  search?: string;
}): Promise<ConversationWithDetails[]> {
  const conditions = [];

  if (filters?.state) {
    conditions.push(eq(conversations.state, filters.state));
  }

  if (filters?.analystId) {
    conditions.push(eq(conversations.analystId, filters.analystId));
  }

  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    conditions.push(
      or(
        sql`${users.name} LIKE ${searchTerm}`,
        sql`${users.email} LIKE ${searchTerm}`,
        sql`${tickets.number} LIKE ${searchTerm}`
      )
    );
  }

  const query = db
    .select({
      id: conversations.id,
      userId: conversations.userId,
      state: conversations.state,
      analystId: conversations.analystId,
      currentTicketId: conversations.currentTicketId,
      messageCount: conversations.messageCount,
      sessionStartedAt: conversations.sessionStartedAt,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
      userName: users.name,
      userEmail: users.email,
      userDepartment: users.department,
      analystName: sql<string>`(SELECT name FROM users WHERE id = ${conversations.analystId})`.as('analystName'),
      currentTicketNumber: sql<string>`(SELECT number FROM tickets WHERE id = ${conversations.currentTicketId})`.as('currentTicketNumber'),
    })
    .from(conversations)
    .leftJoin(users, eq(conversations.userId, users.id))
    .leftJoin(tickets, eq(conversations.currentTicketId, tickets.id))
    .orderBy(desc(conversations.updatedAt));

  if (conditions.length > 0) {
    return query.where(and(...conditions)).then(rows => rows.map(mapConversationRow));
  }

  return query.then(rows => rows.map(mapConversationRow));
}

export async function transitionConversation(
  conversationId: number,
  newState: ConversationState,
  actorId: number,
  options?: { analystId?: number; currentTicketId?: number }
): Promise<ConversationWithDetails> {
  const conv = await getConversationById(conversationId);
  if (!conv) {
    throw new NotFoundError('Conversa não encontrada');
  }

  if (!canTransition(conv.state, newState)) {
    throw new StateTransitionError(`Transição inválida de ${conv.state} para ${newState}`);
  }

  const updateData: Record<string, unknown> = {
    state: newState,
    updatedAt: getClock().now(),
  };

  if (newState === 'com_analista') {
    if (!options?.analystId) {
      throw new ValidationError('analystId obrigatório para assumir atendimento');
    }
    updateData.analystId = options.analystId;
  } else if (newState === 'aguardando_atendente') {
    if (options?.analystId) {
      updateData.analystId = options.analystId;
    }
  }

  if (newState === 'agent' && conv.state === 'com_analista') {
    updateData.analystId = null;
  }

  if (options?.currentTicketId !== undefined) {
    updateData.currentTicketId = options.currentTicketId;
  }

  await db
    .update(conversations)
    .set(updateData)
    .where(eq(conversations.id, conversationId));

  const result = await getConversationById(conversationId);
  if (!result) {
    throw new NotFoundError('Conversa não encontrada após transição');
  }
  return result;
}

export async function incrementMessageCount(conversationId: number): Promise<void> {
  await db
    .update(conversations)
    .set({
      messageCount: sql`${conversations.messageCount} + 1`,
      updatedAt: getClock().now(),
    })
    .where(eq(conversations.id, conversationId));
}

export async function addMessage(
  conversationId: number,
  data: {
    role: 'user' | 'assistant' | 'system' | 'analyst';
    content: string;
    uiKind?: 'options' | 'ticket_selector' | 'ticket_card' | 'draft';
    uiData?: unknown;
    decisionTrace?: unknown;
    tokensIn?: number;
    tokensOut?: number;
    costUsd?: string;
  }
): Promise<MessageWithDecision> {
  const [message] = await db
    .insert(messages)
    .values({
      conversationId,
      role: data.role,
      content: data.content,
      uiKind: data.uiKind,
      uiData: data.uiData,
      decisionTrace: data.decisionTrace,
      tokensIn: data.tokensIn,
      tokensOut: data.tokensOut,
      costUsd: data.costUsd,
    })
    .returning();

  await incrementMessageCount(conversationId);

  if (!message) {
    throw new Error('Falha ao inserir mensagem');
  }

  return {
    id: message.id,
    conversationId: message.conversationId,
    role: message.role,
    content: message.content,
    uiKind: message.uiKind ?? undefined,
    uiData: message.uiData,
    decisionTrace: message.decisionTrace,
    tokensIn: message.tokensIn ?? undefined,
    tokensOut: message.tokensOut ?? undefined,
    costUsd: message.costUsd ?? undefined,
    createdAt: message.createdAt,
  };
}

export async function getMessages(conversationId: number, limit = 50): Promise<MessageWithDecision[]> {
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  return rows
    .reverse()
    .map(row => ({
      id: row.id,
      conversationId: row.conversationId,
      role: row.role,
      content: row.content,
      uiKind: row.uiKind ?? undefined,
      uiData: row.uiData,
      decisionTrace: row.decisionTrace,
      tokensIn: row.tokensIn ?? undefined,
      tokensOut: row.tokensOut ?? undefined,
      costUsd: row.costUsd ?? undefined,
      createdAt: row.createdAt,
    }));
}

export async function resetSession(conversationId: number): Promise<ConversationWithDetails> {
  await db
    .update(conversations)
    .set({
      state: 'agent',
      messageCount: 0,
      sessionStartedAt: getClock().now(),
      analystId: null,
      currentTicketId: null,
      updatedAt: getClock().now(),
    })
    .where(eq(conversations.id, conversationId));

  const result = await getConversationById(conversationId);
  if (!result) {
    throw new NotFoundError('Conversa não encontrada após reset');
  }
  return result;
}

export function createConversationsService() {
  return {
    getOrCreateConversation,
    getConversationById,
    listConversationsForAnalyst,
    transitionConversation,
    addMessage,
    getMessages,
    resetSession,
  };
}

export const conversationsService = createConversationsService();