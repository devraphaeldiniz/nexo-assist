import { z } from 'zod';

export const AgentDecisionSchema = z.object({
  intent: z.enum([
    'duvida',
    'consultar_chamado',
    'abrir_chamado',
    'atualizar_chamado',
    'falar_com_analista',
    'fora_de_escopo',
    'outro',
  ]),
  understood: z.string().min(1).max(200),
  action: z.string().min(1).max(200),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1).max(500),
  rulesApplied: z.array(z.string()).default([]),
});

export type AgentDecision = z.infer<typeof AgentDecisionSchema>;

export const AgentTurnSchema = z.object({
  message: z.string(),
  ui: z.union([
    z.object({ kind: z.literal('options'), question: z.string(), options: z.array(z.string()) }),
    z.object({ kind: z.literal('ticket_selector'), ticketNumbers: z.array(z.string()) }),
    z.object({ kind: z.literal('ticket_card'), ticketNumber: z.string() }),
    z.object({ kind: z.literal('draft'), draftId: z.string() }),
  ]).optional(),
  decision: AgentDecisionSchema,
});

export type AgentTurn = z.infer<typeof AgentTurnSchema>;

export const ToolResultSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
});

export type ToolResult<T = unknown> = z.infer<typeof ToolResultSchema> & { data?: T };