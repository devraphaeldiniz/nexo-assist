import { describe, it, expect } from 'vitest';
import { canTransition, VALID_TRANSITIONS } from '@/services/conversations/service';

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
});