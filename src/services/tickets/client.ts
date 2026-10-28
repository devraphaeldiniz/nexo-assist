import { db } from '@/db';
import { tickets, ticketEvents, users } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { LegacySystemError, NotFoundError, ConflictError } from '@/lib/errors';
import { calculateSLA, Priority } from '@/services/sla';
import { getClock } from '@/lib/clock';

export interface TicketData {
  number?: string;
  title: string;
  description: string;
  type: 'INC' | 'REQ';
  category: string;
  priority: Priority;
  requesterId: number;
  assigneeId?: number;
  dueAt?: Date;
  status?: 'aberto' | 'em_andamento' | 'aguardando_usuario' | 'aguardando_aprovacao' | 'resolvido' | 'cancelado';
}

export interface TicketWithDetails extends TicketData {
  id: number;
  number: string;
  requesterName: string;
  requesterEmail: string;
  requesterDepartment: string;
  assigneeName?: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  isOverdue: boolean;
  businessHoursRemaining: number;
}

export interface TicketClient {
  listByRequester(requesterId: number, status?: string): Promise<TicketWithDetails[]>;
  getById(id: number, requesterId?: number): Promise<TicketWithDetails | null>;
  create(data: TicketData, idempotencyKey: string): Promise<TicketWithDetails>;
  update(id: number, data: Partial<TicketData>, actorId: number): Promise<TicketWithDetails>;
  addNote(id: number, note: string, actorId: number): Promise<TicketWithDetails>;
  reopen(id: number, actorId: number): Promise<TicketWithDetails>;
  transfer(id: number, assigneeId: number, actorId: number): Promise<TicketWithDetails>;
}

const FAILURE_RATE = parseFloat(process.env.LEGACY_FAILURE_RATE || '0');
const BASE_LATENCY_MS = parseInt(process.env.LEGACY_BASE_LATENCY_MS || '100', 10);

async function simulateLegacyBehavior<T>(operation: () => Promise<T>): Promise<T> {
  const latency = BASE_LATENCY_MS + Math.random() * 200;
  await new Promise(resolve => setTimeout(resolve, latency));

  if (Math.random() < FAILURE_RATE) {
    throw new LegacySystemError('Sistema de chamados instável, tente em instantes');
  }

  return operation();
}

function generateTicketNumber(type: 'INC' | 'REQ'): string {
  const prefix = type === 'INC' ? 'INC' : 'REQ';
  const timestamp = Date.now().toString().slice(-5);
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${timestamp}${random}`;
}

function mapTicketRow(row: any): TicketWithDetails {
  const priority = row.priority as Priority;
  const sla = calculateSLA(row.createdAt, priority, getClock());
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    description: row.description,
    type: row.type,
    category: row.category,
    priority: row.priority,
    status: row.status,
    requesterId: row.requesterId,
    assigneeId: row.assigneeId,
    dueAt: row.dueAt,
    requesterName: row.requesterName,
    requesterEmail: row.requesterEmail,
    requesterDepartment: row.requesterDepartment,
    assigneeName: row.assigneeName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    resolvedAt: row.resolvedAt,
    isOverdue: sla.isOverdue,
    businessHoursRemaining: sla.businessHoursRemaining,
  };
}

export function createTicketClient(): TicketClient {
  return {
    async listByRequester(requesterId: number, status?: string) {
      return simulateLegacyBehavior(async () => {
        const conditions = [eq(tickets.requesterId, requesterId)];
        if (status) {
          conditions.push(eq(tickets.status, status as typeof tickets.status.enumValues[number]));
        }

        const rows = await db
          .select({
            id: tickets.id,
            number: tickets.number,
            title: tickets.title,
            description: tickets.description,
            type: tickets.type,
            category: tickets.category,
            priority: tickets.priority,
            status: tickets.status,
            requesterId: tickets.requesterId,
            assigneeId: tickets.assigneeId,
            dueAt: tickets.dueAt,
            resolvedAt: tickets.resolvedAt,
            createdAt: tickets.createdAt,
            updatedAt: tickets.updatedAt,
            requesterName: users.name,
            requesterEmail: users.email,
            requesterDepartment: users.department,
            assigneeName: sql<string>`(SELECT name FROM users WHERE id = ${tickets.assigneeId})`.as('assigneeName'),
          })
          .from(tickets)
          .leftJoin(users, eq(tickets.requesterId, users.id))
          .where(and(...conditions))
          .orderBy(desc(tickets.createdAt));

        return rows.map(mapTicketRow);
      });
    },

    async getById(id: number, requesterId?: number) {
      return simulateLegacyBehavior(async () => {
        const conditions = [eq(tickets.id, id)];
        if (requesterId) {
          conditions.push(eq(tickets.requesterId, requesterId));
        }

        const row = await db
          .select({
            id: tickets.id,
            number: tickets.number,
            title: tickets.title,
            description: tickets.description,
            type: tickets.type,
            category: tickets.category,
            priority: tickets.priority,
            status: tickets.status,
            requesterId: tickets.requesterId,
            assigneeId: tickets.assigneeId,
            dueAt: tickets.dueAt,
            resolvedAt: tickets.resolvedAt,
            createdAt: tickets.createdAt,
            updatedAt: tickets.updatedAt,
            requesterName: users.name,
            requesterEmail: users.email,
            requesterDepartment: users.department,
            assigneeName: sql<string>`(SELECT name FROM users WHERE id = ${tickets.assigneeId})`.as('assigneeName'),
          })
          .from(tickets)
          .leftJoin(users, eq(tickets.requesterId, users.id))
          .where(and(...conditions))
          .limit(1);

        if (!row[0]) return null;
        return mapTicketRow(row[0]);
      });
    },

    async create(data: TicketData, idempotencyKey: string) {
      return simulateLegacyBehavior(async () => {
        const number = data.number || generateTicketNumber(data.type);

        const existing = await db
          .select({ id: tickets.id })
          .from(tickets)
          .where(eq(tickets.number, number))
          .limit(1);

        if (existing.length > 0) {
          throw new ConflictError('Chamado já existe');
        }

        const priority = data.priority;
        const dueAt = calculateSLA(new Date(), priority, getClock()).dueAt;

        const [ticket] = await db
          .insert(tickets)
          .values({
            number,
            title: data.title,
            description: data.description,
            type: data.type,
            category: data.category,
            priority,
            status: data.status || 'aberto',
            requesterId: data.requesterId,
            assigneeId: data.assigneeId,
            dueAt,
          })
          .returning();

        if (!ticket) {
          throw new Error('Failed to create ticket');
        }

        await db.insert(ticketEvents).values({
          ticketId: ticket.id,
          actorId: data.requesterId,
          type: 'created',
          payload: { idempotencyKey },
        });

        const created = await this.getById(ticket.id);
        if (!created) {
          throw new Error('Failed to retrieve created ticket');
        }
        return created;
      });
    },

    async update(id: number, data: Partial<TicketData>, actorId: number) {
      return simulateLegacyBehavior(async () => {
        const [ticket] = await db
          .update(tickets)
          .set({
            ...data,
            updatedAt: getClock().now(),
          })
          .where(eq(tickets.id, id))
          .returning();

        if (!ticket) {
          throw new NotFoundError('Chamado não encontrado');
        }

        await db.insert(ticketEvents).values({
          ticketId: id,
          actorId,
          type: 'updated',
          payload: data,
        });

        return this.getById(id) as Promise<TicketWithDetails>;
      });
    },

    async addNote(id: number, note: string, actorId: number) {
      return simulateLegacyBehavior(async () => {
        const ticket = await db
          .select()
          .from(tickets)
          .where(eq(tickets.id, id))
          .limit(1);

        if (!ticket[0]) {
          throw new NotFoundError('Chamado não encontrado');
        }

        await db.insert(ticketEvents).values({
          ticketId: id,
          actorId,
          type: 'note_added',
          payload: { note },
        });

        await db
          .update(tickets)
          .set({ updatedAt: getClock().now() })
          .where(eq(tickets.id, id));

        return this.getById(id) as Promise<TicketWithDetails>;
      });
    },

    async reopen(id: number, actorId: number) {
      return simulateLegacyBehavior(async () => {
        const ticket = await db
          .select()
          .from(tickets)
          .where(eq(tickets.id, id))
          .limit(1);

        if (!ticket[0]) {
          throw new NotFoundError('Chamado não encontrado');
        }

        const priority = ticket[0].priority as Priority;
        const dueAt = calculateSLA(getClock().now(), priority, getClock()).dueAt;

        await db
          .update(tickets)
          .set({
            status: 'aberto',
            resolvedAt: null,
            dueAt,
            updatedAt: getClock().now(),
          })
          .where(eq(tickets.id, id));

        await db.insert(ticketEvents).values({
          ticketId: id,
          actorId,
          type: 'reopened',
          payload: {},
        });

        return this.getById(id) as Promise<TicketWithDetails>;
      });
    },

    async transfer(id: number, assigneeId: number, actorId: number) {
      return simulateLegacyBehavior(async () => {
        const ticket = await db
          .select()
          .from(tickets)
          .where(eq(tickets.id, id))
          .limit(1);

        if (!ticket[0]) {
          throw new NotFoundError('Chamado não encontrado');
        }

        await db
          .update(tickets)
          .set({
            assigneeId,
            status: 'em_andamento',
            updatedAt: getClock().now(),
          })
          .where(eq(tickets.id, id));

        await db.insert(ticketEvents).values({
          ticketId: id,
          actorId,
          type: 'transferred',
          payload: { assigneeId },
        });

        return this.getById(id) as Promise<TicketWithDetails>;
      });
    },
  };
}

export const ticketsClient = createTicketClient();