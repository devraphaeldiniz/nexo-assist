import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  department: text('department').notNull(),
  role: text('role', { enum: ['employee', 'analyst'] }).notNull().default('employee'),
  avatarInitials: text('avatar_initials'),
  passwordHash: text('password_hash'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const helpArticles = sqliteTable('help_articles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  category: text('category').notNull(),
  tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const tickets = sqliteTable('tickets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  number: text('number').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  type: text('type', { enum: ['INC', 'REQ'] }).notNull(),
  category: text('category').notNull(),
  priority: text('priority', { enum: ['critica', 'alta', 'media', 'baixa'] }).notNull(),
  status: text('status', { enum: ['aberto', 'em_andamento', 'aguardando_usuario', 'aguardando_aprovacao', 'aprovado', 'resolvido', 'cancelado'] }).notNull().default('aberto'),
  requesterId: integer('requester_id').notNull().references(() => users.id),
  assigneeId: integer('assignee_id').references(() => users.id),
  dueAt: integer('due_at', { mode: 'timestamp' }),
  resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const ticketEvents = sqliteTable('ticket_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ticketId: integer('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  actorId: integer('actor_id').notNull().references(() => users.id),
  type: text('type', { enum: ['created', 'updated', 'note_added', 'status_changed', 'assigned', 'transferred', 'reopened', 'resolved'] }).notNull(),
  payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const conversations = sqliteTable('conversations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  state: text('state', { enum: ['agent', 'aguardando_atendente', 'com_analista', 'encerrada'] }).notNull().default('agent'),
  analystId: integer('analyst_id').references(() => users.id),
  currentTicketId: integer('current_ticket_id').references(() => tickets.id),
  messageCount: integer('message_count').notNull().default(0),
  sessionStartedAt: integer('session_started_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  conversationId: integer('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant', 'system', 'analyst'] }).notNull(),
  content: text('content').notNull(),
  uiKind: text('ui_kind', { enum: ['options', 'ticket_selector', 'ticket_card', 'draft'] }),
  uiData: text('ui_data', { mode: 'json' }),
  decisionTrace: text('decision_trace', { mode: 'json' }),
  tokensIn: integer('tokens_in'),
  tokensOut: integer('tokens_out'),
  costUsd: text('cost_usd'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const drafts = sqliteTable('drafts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  conversationId: integer('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  ticketId: integer('ticket_id').references(() => tickets.id),
  type: text('type', { enum: ['novo', 'atualizacao', 'reabertura'] }).notNull(),
  payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  status: text('status', { enum: ['pendente', 'confirmado', 'substituido', 'cancelado'] }).notNull().default('pendente'),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  confirmedAt: integer('confirmed_at', { mode: 'timestamp' }),
});