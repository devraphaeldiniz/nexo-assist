import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { db } from '@/db';
import { drafts } from '@/db/schema';
import { ticketsClient } from '@/services/tickets/client';
import { searchHelpArticles } from '@/services/helpdesk/service';
import { createConversationsService } from '@/services/conversations/service';

const conversationsService = createConversationsService();

export const buscarCentralDeAjuda = createTool({
  id: 'buscar_central_de_ajuda',
  description: 'Busca artigos na central de ajuda da Nexo. Use para dúvidas gerais, procedimentos, como-fazer.',
  inputSchema: z.object({
    query: z.string().min(2).describe('Termos de busca (ex: "reset senha", "configurar vpn", "wifi corporativo")'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    articles: z.array(z.object({
      id: z.number(),
      title: z.string(),
      content: z.string(),
      category: z.string(),
      tags: z.array(z.string()),
    })),
    error: z.string().optional(),
  }),
  execute: async ({ query }: { query: string }) => {
    try {
      const articles = await searchHelpArticles(query, 5);
      return {
        success: true,
        articles: articles.map(a => ({
          id: a.id,
          title: a.title,
          content: a.content,
          category: a.category,
          tags: a.tags,
        })),
      };
    } catch {
      return {
        success: false,
        articles: [],
        error: 'Erro ao buscar na central de ajuda',
      };
    }
  },
});

export const listarMeusChamados = createTool({
  id: 'listar_meus_chamados',
  description: 'Lista os chamados do usuário autenticado. Opcionalmente filtra por status.',
  inputSchema: z.object({
    status: z.enum(['aberto', 'em_andamento', 'aguardando_usuario', 'aguardando_aprovacao', 'aprovado', 'resolvido', 'cancelado']).optional()
      .describe('Filtrar por status (opcional)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    tickets: z.array(z.object({
      id: z.number(),
      number: z.string(),
      title: z.string(),
      type: z.string(),
      category: z.string(),
      priority: z.string(),
      status: z.string(),
      dueAt: z.string().nullable(),
      isOverdue: z.boolean(),
      businessHoursRemaining: z.number(),
      createdAt: z.string(),
      updatedAt: z.string(),
    })),
    error: z.string().optional(),
  }),
  // Mastra não exporta um tipo público para RequestContext aqui; getRaw() é a API usada.
  execute: async ({ status }: { status?: string }, context: { requestContext: any }) => {
    try {
      const userId = context.requestContext.getRaw('userId') as number;
      if (!userId) {
        return { success: false, tickets: [], error: 'Usuário não identificado' };
      }

      const tickets = await ticketsClient.listByRequester(userId, status);
      return {
        success: true,
        tickets: tickets.map(t => ({
          id: t.id,
          number: t.number,
          title: t.title,
          type: String(t.type),
          category: String(t.category),
          priority: String(t.priority),
          status: String(t.status),
          dueAt: t.dueAt?.toISOString() || null,
          isOverdue: t.isOverdue,
          businessHoursRemaining: t.businessHoursRemaining,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        })),
      };
    } catch (error) {
      return {
        success: false,
        tickets: [],
        error: error instanceof Error ? error.message : 'Erro ao listar chamados',
      };
    }
  },
});

export const obterChamado = createTool({
  id: 'obter_chamado',
  description: 'Obtém detalhes completos de um chamado específico. Só funciona se o chamado pertencer ao usuário.',
  inputSchema: z.object({
    numero: z.string().describe('Número do chamado (ex: INC-20311, REQ-10442)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    ticket: z.object({
      id: z.number(),
      number: z.string(),
      title: z.string(),
      description: z.string(),
      type: z.string(),
      category: z.string(),
      priority: z.string(),
      status: z.string(),
      dueAt: z.string().nullable(),
      isOverdue: z.boolean(),
      businessHoursRemaining: z.number(),
      requesterName: z.string(),
      assigneeName: z.string().nullable(),
      createdAt: z.string(),
      updatedAt: z.string(),
      resolvedAt: z.string().nullable(),
    }).nullable(),
    error: z.string().optional(),
  }),
  // Mastra não exporta um tipo público para RequestContext aqui; getRaw() é a API usada.
  execute: async ({ numero }: { numero: string }, context: { requestContext: any }) => {
    try {
      const userId = context.requestContext.getRaw('userId') as number;
      if (!userId) {
        return { success: false, ticket: null, error: 'Usuário não identificado' };
      }

      const tickets = await ticketsClient.listByRequester(userId);
      const ticket = tickets.find(t => t.number.toUpperCase() === numero.toUpperCase());

      if (!ticket) {
        return { success: true, ticket: null };
      }

      return {
        success: true,
        ticket: {
          id: ticket.id,
          number: ticket.number,
          title: ticket.title,
          description: ticket.description,
          type: String(ticket.type),
          category: String(ticket.category),
          priority: String(ticket.priority),
          status: String(ticket.status),
          dueAt: ticket.dueAt?.toISOString() || null,
          isOverdue: ticket.isOverdue,
          businessHoursRemaining: ticket.businessHoursRemaining,
          requesterName: ticket.requesterName,
          assigneeName: ticket.assigneeName || null,
          createdAt: ticket.createdAt.toISOString(),
          updatedAt: ticket.updatedAt.toISOString(),
          resolvedAt: ticket.resolvedAt?.toISOString() || null,
        },
      };
    } catch (error) {
      return {
        success: false,
        ticket: null,
        error: error instanceof Error ? error.message : 'Erro ao obter chamado',
      };
    }
  },
});

export const prepararRascunho = createTool({
  id: 'preparar_rascunho',
  description: 'Prepara um rascunho de chamado (novo, atualização ou reabertura). Valida campos, checa duplicidade, calcula prazo. NÃO cria no sistema legado - requer confirmação posterior.',
  inputSchema: z.object({
    tipo: z.enum(['novo', 'atualizacao', 'reabertura']).describe('Tipo de rascunho'),
    titulo: z.string().min(5).max(120).describe('Título do chamado'),
    descricao: z.string().min(10).describe('Descrição detalhada do problema ou solicitação'),
    tipoChamado: z.enum(['INC', 'REQ']).optional().describe('INC=Incidente, REQ=Requisição (obrigatório para novo)'),
    categoria: z.enum(['Acesso', 'Rede e VPN', 'Hardware', 'Software', 'E-mail', 'Outros']).optional().describe('Categoria (obrigatório para novo)'),
    prioridade: z.enum(['critica', 'alta', 'media', 'baixa']).optional().describe('Prioridade (obrigatório para novo)'),
    chamadoId: z.number().optional().describe('ID do chamado existente (para atualização/reabertura)'),
    numeroChamado: z.string().optional().describe('Número do chamado existente (para atualização/reabertura)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    draftId: z.string().nullable(),
    draftNumber: z.string().nullable(),
    preview: z.object({
      titulo: z.string(),
      descricao: z.string(),
      tipoChamado: z.string(),
      categoria: z.string(),
      prioridade: z.string(),
      prazoPrevisto: z.string(),
      duplicadoDe: z.string().nullable(),
      reaberturaPermitida: z.boolean(),
    }).nullable(),
    error: z.string().optional(),
    warnings: z.array(z.string()).optional(),
  }),
  execute: async (
    input: {
      tipo: 'novo' | 'atualizacao' | 'reabertura';
      titulo: string;
      descricao: string;
      tipoChamado?: 'INC' | 'REQ';
      categoria?: 'Acesso' | 'Rede e VPN' | 'Hardware' | 'Software' | 'E-mail' | 'Outros';
      prioridade?: 'critica' | 'alta' | 'media' | 'baixa';
      chamadoId?: number;
      numeroChamado?: string;
    },
    context: { requestContext: any } // Mastra não exporta um tipo público para RequestContext aqui; getRaw() é a API usada.
  ) => {
    try {
      const userId = context.requestContext.getRaw('userId') as number;
      const conversationId = context.requestContext.getRaw('conversationId') as number;
      if (!userId || !conversationId) {
        return { success: false, draftId: null, draftNumber: null, preview: null, error: 'Contexto inválido' };
      }

      const { tipo, titulo, descricao, tipoChamado, categoria, prioridade, chamadoId, numeroChamado } = input;

      let targetTicketId = chamadoId;
      let targetTicketNumber = numeroChamado;
      let existingTicket = null;
      let warnings: string[] = [];

      if (tipo === 'novo') {
        if (!tipoChamado || !categoria || !prioridade) {
          return { success: false, draftId: null, draftNumber: null, preview: null, error: 'Para novo chamado, tipoChamado, categoria e prioridade são obrigatórios' };
        }

        const userTickets = await ticketsClient.listByRequester(userId, 'aberto');
        const userTicketsEmAndamento = await ticketsClient.listByRequester(userId, 'em_andamento');
        const allOpenTickets = [...userTickets, ...userTicketsEmAndamento];

        const similarTicket = allOpenTickets.find(t =>
          t.title.toLowerCase().includes(titulo.toLowerCase().split(' ')[0] ?? '') ||
          titulo.toLowerCase().includes(t.title.toLowerCase().split(' ')[0] ?? '')
        );

        if (similarTicket) {
          existingTicket = similarTicket.number;
          warnings.push(`Já existe um chamado aberto similar: ${similarTicket.number} - ${similarTicket.title}. Considere atualizar em vez de criar novo.`);
        }
      } else {
        if (!targetTicketId && !targetTicketNumber) {
          return { success: false, draftId: null, draftNumber: null, preview: null, error: 'Para atualização/reabertura, informe chamadoId ou numeroChamado' };
        }

        if (targetTicketNumber) {
          const userTickets = await ticketsClient.listByRequester(userId);
          const found = userTickets.find(t => t.number === targetTicketNumber);
          if (found) targetTicketId = found.id;
        }

        if (!targetTicketId) {
          return { success: false, draftId: null, draftNumber: null, preview: null, error: 'Chamado não encontrado ou não pertence a você' };
        }

        const ticket = await ticketsClient.getById(targetTicketId, userId);
        if (!ticket) {
          return { success: false, draftId: null, draftNumber: null, preview: null, error: 'Chamado não encontrado ou não pertence a você' };
        }

        if (tipo === 'reabertura') {
          if (ticket.status !== 'resolvido') {
            return { success: false, draftId: null, draftNumber: null, preview: null, error: 'Só é possível reabrir chamados resolvidos' };
          }
          const daysSinceResolved = ticket.resolvedAt
            ? Math.floor((Date.now() - ticket.resolvedAt.getTime()) / (1000 * 60 * 60 * 24))
            : 999;
          if (daysSinceResolved > 7) {
            return { success: false, draftId: null, draftNumber: null, preview: null, error: 'Chamados resolvidos há mais de 7 dias não podem ser reabertos. Crie um novo.' };
          }
        }
      }

      const draftNumber = `D-${Date.now().toString().slice(-6)}`;
      const idempotencyKey = `draft-${conversationId}-${draftNumber}`;

      const preview = {
        titulo,
        descricao,
        tipoChamado: tipoChamado || (existingTicket ? 'EXISTING' : 'N/A'),
        categoria: categoria || 'N/A',
        prioridade: prioridade || 'N/A',
        prazoPrevisto: 'Calculado na confirmação',
        duplicadoDe: existingTicket,
        reaberturaPermitida: tipo === 'reabertura',
      };

      await db.insert(drafts).values({
        conversationId,
        ticketId: targetTicketId,
        type: tipo,
        payload: input,
        status: 'pendente',
        idempotencyKey,
      });

      return {
        success: true,
        draftId: idempotencyKey,
        draftNumber,
        preview,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        success: false,
        draftId: null,
        draftNumber: null,
        preview: null,
        error: error instanceof Error ? error.message : 'Erro ao preparar rascunho',
      };
    }
  },
});

export const transferirParaAnalista = createTool({
  id: 'transferir_para_analista',
  description: 'Transfere a conversa para um analista humano. O agent pausa e não responde mais até ser devolvido.',
  inputSchema: z.object({
    motivo: z.enum(['usuario_pediu', 'caso_critico', 'chamado_vencido', 'baixa_confianca', 'fora_escopo']).describe('Motivo da transferência'),
    resumo: z.string().min(20).max(500).describe('Resumo do caso para o analista (o que foi feito, o que falta, dados relevantes)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    error: z.string().optional(),
  }),
  // Mastra não exporta um tipo público para RequestContext aqui; getRaw() é a API usada.
  execute: async ({ motivo, resumo }: { motivo: string; resumo: string }, context: { requestContext: any }) => {
    try {
      const conversationId = context.requestContext.getRaw('conversationId') as number;
      const userId = context.requestContext.getRaw('userId') as number;
      if (!conversationId || !userId) {
        return { success: false, message: '', error: 'Contexto inválido' };
      }

      await conversationsService.transitionConversation(conversationId, 'aguardando_atendente', userId, {
        analystId: userId,
      });

      await conversationsService.addMessage(conversationId, {
        role: 'system',
        content: `Transferida para analista. Motivo: ${motivo}. Resumo: ${resumo}`,
        uiKind: 'options',
        uiData: { question: 'Transferindo para um analista...', options: ['Aguardar'] },
      });

      const motivoLabels: Record<string, string> = {
        usuario_pediu: 'Você pediu para falar com um analista',
        caso_critico: 'Caso crítico detectado (equipe/empresa parada)',
        chamado_vencido: 'Chamado vencido - você aceitou falar com analista',
        baixa_confianca: 'O agent não teve segurança para decidir',
        fora_escopo: 'Assunto fora do escopo de TI',
      };

      return {
        success: true,
        message: `${motivoLabels[motivo]}. Um analista assumirá em breve. Resumo enviado: ${resumo}`,
      };
    } catch (error) {
      return {
        success: false,
        message: '',
        error: error instanceof Error ? error.message : 'Erro ao transferir',
      };
    }
  },
});

export const perguntarAoUsuario = createTool({
  id: 'perguntar_ao_usuario',
  description: 'Faz uma pergunta ao usuário com opções de resposta rápida (botões numerados 1-4).',
  inputSchema: z.object({
    pergunta: z.string().min(5).max(200).describe('Pergunta clara para o usuário'),
    opcoes: z.array(z.string().min(1).max(50)).min(2).max(4).describe('2 a 4 opções de resposta'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    ui: z.object({
      kind: z.literal('options'),
      question: z.string(),
      options: z.array(z.string()),
    }).nullable(),
    error: z.string().optional(),
  }),
  execute: async ({ pergunta, opcoes }: { pergunta: string; opcoes: string[] }) => {
    return {
      success: true,
      ui: {
        kind: 'options' as const,
        question: pergunta,
        options: opcoes,
      },
    };
  },
});