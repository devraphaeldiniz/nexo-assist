import { describe, it, expect } from 'vitest';
import { ticketsClient } from '@/services/tickets/client';
import { createConversationsService } from '@/services/conversations/service';
import { searchHelpArticles } from '@/services/helpdesk/service';
import { authenticateUser } from '@/services/auth/service';
import { AuthenticationError } from '@/lib/errors';

const conversationsService = createConversationsService();

describe('Services & Database Integration', () => {
  describe('Helpdesk Service', () => {
    it('retorna artigos relevantes para busca por senha', async () => {
      const articles = await searchHelpArticles('senha', 5);
      expect(articles.length).toBeGreaterThan(0);
      expect(articles[0]?.title.toLowerCase()).toContain('senha');
    });

    it('retorna artigos para busca por VPN', async () => {
      const articles = await searchHelpArticles('vpn', 5);
      expect(articles.length).toBeGreaterThan(0);
      expect(articles[0]?.title.toLowerCase()).toContain('vpn');
    });
  });

  describe('Auth Service', () => {
    it('autentica usuário colaborador válido', async () => {
      const { user } = await authenticateUser('ana.souza@nexo.com.br', 'qualquer_senha');
      expect(user).toBeDefined();
      expect(user.name).toBe('Ana Souza');
      expect(user.role).toBe('employee');
    });

    it('autentica analista de TI', async () => {
      const { user } = await authenticateUser('marina.silva@nexo.com.br', 'qualquer_senha');
      expect(user).toBeDefined();
      expect(user.name).toBe('Marina Silva');
      expect(user.role).toBe('analyst');
    });

    it('rejeita e-mail inexistente com AuthenticationError', async () => {
      await expect(authenticateUser('inexistente@nexo.com.br', 'senha')).rejects.toThrow(AuthenticationError);
    });
  });

  describe('Tickets Client', () => {
    it('lista chamados por solicitante', async () => {
      const { user } = await authenticateUser('ana.souza@nexo.com.br', 'senha');
      const tickets = await ticketsClient.listByRequester(user.id);
      expect(tickets.length).toBeGreaterThan(0);
      expect(tickets[0]?.requesterId).toBe(user.id);
      expect(tickets[0]?.number).toMatch(/^(INC|REQ)-\d+/);
    });

    it('permite criar novo chamado com idempotência', async () => {
      const { user } = await authenticateUser('ana.souza@nexo.com.br', 'senha');
      const idempotencyKey = `test-draft-${Date.now()}`;
      const newTicket = await ticketsClient.create({
        title: 'Teste de criação de chamado unitário',
        description: 'Descrição detalhada para teste de serviço de chamados',
        type: 'REQ',
        category: 'Software',
        priority: 'baixa',
        requesterId: user.id,
      }, idempotencyKey);

      expect(newTicket).not.toBeNull();
      expect(newTicket.id).toBeDefined();
      expect(newTicket.number).toMatch(/^REQ-/);
      expect(newTicket.title).toBe('Teste de criação de chamado unitário');
    });
  });

  describe('Conversations Service', () => {
    it('cria ou recupera conversa para usuário', async () => {
      const { user } = await authenticateUser('diego.ramos@nexo.com.br', 'senha');
      const conv = await conversationsService.getOrCreateConversation(user.id);
      expect(conv).toBeDefined();
      expect(conv.userId).toBe(user.id);
      expect(conv.state).toBe('agent');
    });

    it('adiciona mensagem e recupera histórico', async () => {
      const { user } = await authenticateUser('diego.ramos@nexo.com.br', 'senha');
      const conv = await conversationsService.getOrCreateConversation(user.id);
      const msg = await conversationsService.addMessage(conv.id, {
        role: 'user',
        content: 'Olá, preciso de ajuda com meu e-mail',
      });

      expect(msg).toBeDefined();
      expect(msg.content).toBe('Olá, preciso de ajuda com meu e-mail');

      const messages = await conversationsService.getMessages(conv.id, 5);
      expect(messages.length).toBeGreaterThan(0);
      const lastMsg = messages[messages.length - 1];
      expect(lastMsg?.content).toBe('Olá, preciso de ajuda com meu e-mail');
    });
  });
});
