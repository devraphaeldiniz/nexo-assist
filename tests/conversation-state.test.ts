import { describe, it, expect } from 'vitest';
import {
  canTransition,
  VALID_TRANSITIONS,
  createConversationsService,
} from '@/services/conversations/service';
import { StateTransitionError } from '@/lib/errors';
import { authenticateUser } from '@/services/auth/service';

const conversationsService = createConversationsService();

describe('Conversation State Machine', () => {
  describe('VALID_TRANSITIONS', () => {
    it('agent pode ir para aguardando_atendente ou encerrada', () => {
      expect(VALID_TRANSITIONS.agent).toContain('aguardando_atendente');
      expect(VALID_TRANSITIONS.agent).toContain('encerrada');
      expect(VALID_TRANSITIONS.agent).not.toContain('com_analista');
      expect(VALID_TRANSITIONS.agent).not.toContain('agent');
    });

    it('aguardando_atendente pode ir para com_analista, agent ou encerrada', () => {
      expect(VALID_TRANSITIONS.aguardando_atendente).toContain('com_analista');
      expect(VALID_TRANSITIONS.aguardando_atendente).toContain('agent');
      expect(VALID_TRANSITIONS.aguardando_atendente).toContain('encerrada');
    });

    it('com_analista pode ir para agent ou encerrada', () => {
      expect(VALID_TRANSITIONS.com_analista).toContain('agent');
      expect(VALID_TRANSITIONS.com_analista).toContain('encerrada');
      expect(VALID_TRANSITIONS.com_analista).not.toContain('aguardando_atendente');
    });

    it('encerrada não pode ir para nenhum estado', () => {
      expect(VALID_TRANSITIONS.encerrada).toHaveLength(0);
    });
  });

  describe('canTransition', () => {
    it('permite transições válidas', () => {
      expect(canTransition('agent', 'aguardando_atendente')).toBe(true);
      expect(canTransition('agent', 'encerrada')).toBe(true);
      expect(canTransition('aguardando_atendente', 'com_analista')).toBe(true);
      expect(canTransition('aguardando_atendente', 'agent')).toBe(true);
      expect(canTransition('aguardando_atendente', 'encerrada')).toBe(true);
      expect(canTransition('com_analista', 'agent')).toBe(true);
      expect(canTransition('com_analista', 'encerrada')).toBe(true);
    });

    it('rejeita transições inválidas', () => {
      expect(canTransition('agent', 'com_analista')).toBe(false);
      expect(canTransition('agent', 'agent')).toBe(false);
      expect(canTransition('com_analista', 'aguardando_atendente')).toBe(false);
      expect(canTransition('encerrada', 'agent')).toBe(false);
      expect(canTransition('encerrada', 'com_analista')).toBe(false);
    });
  });

  describe('Service Lifecycle Transitions', () => {
    it('executa transição válida agent -> aguardando_atendente -> com_analista -> agent', async () => {
      const { user } = await authenticateUser('diego.ramos@nexo.com.br', 'senha');
      const { user: analyst } = await authenticateUser('marina.silva@nexo.com.br', 'senha');

      const conv = await conversationsService.getOrCreateConversation(user.id);
      expect(conv.state).toBe('agent');

      // 1. Transferir para fila de espera
      const waiting = await conversationsService.transitionConversation(
        conv.id,
        'aguardando_atendente',
        user.id
      );
      expect(waiting.state).toBe('aguardando_atendente');

      // 2. Analista assume
      const assumed = await conversationsService.transitionConversation(
        conv.id,
        'com_analista',
        analyst.id,
        { analystId: analyst.id }
      );
      expect(assumed.state).toBe('com_analista');
      expect(assumed.analystId).toBe(analyst.id);

      // 3. Analista devolve para o agent
      const returned = await conversationsService.transitionConversation(
        conv.id,
        'agent',
        analyst.id
      );
      expect(returned.state).toBe('agent');
    });

    it('rejeita transição ilegal com StateTransitionError', async () => {
      const { user } = await authenticateUser('diego.ramos@nexo.com.br', 'senha');
      const conv = await conversationsService.getOrCreateConversation(user.id);

      // De agent direto para com_analista é proibido (deve passar por aguardando_atendente)
      await expect(
        conversationsService.transitionConversation(conv.id, 'com_analista', user.id)
      ).rejects.toThrow(StateTransitionError);
    });
  });
});
