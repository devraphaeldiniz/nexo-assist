import { describe, it, expect, vi } from 'vitest';
import { applyGuardrails, validateDecision } from '@/agent/guardrails';
import { AgentTurn } from '@/agent/decision';

describe('Guardrails', () => {
  const baseTurn: AgentTurn = {
    message: 'Teste',
    decision: {
      intent: 'duvida',
      understood: 'Usuário tem uma dúvida',
      action: 'Responder pela central de ajuda',
      confidence: 0.8,
      reasoning: 'Dúvida genérica sobre procedimento',
      rulesApplied: ['Resolução sem fila'],
    },
  };

  describe('applyGuardrails', () => {
    it('permite turno normal com confiança alta', () => {
      const result = applyGuardrails(baseTurn, {
        conversationState: 'agent',
        hasConfirmation: false,
        isWritingAction: false,
      });
      
      expect(result.allowed).toBe(true);
    });

    it('bloqueia se conversa não está com agent', () => {
      const result = applyGuardrails(baseTurn, {
        conversationState: 'com_analista',
        hasConfirmation: false,
        isWritingAction: false,
      });
      
      expect(result.allowed).toBe(false);
      expect(result.modifiedTurn?.decision.intent).toBe('outro');
      expect(result.reason).toContain('não permite atuação');
    });

    it('força transferência se confiança abaixo do limiar', () => {
      const lowConfidenceTurn: AgentTurn = {
        ...baseTurn,
        decision: { ...baseTurn.decision, confidence: 0.4 },
      };
      
      const result = applyGuardrails(lowConfidenceTurn, {
        conversationState: 'agent',
        hasConfirmation: false,
        isWritingAction: false,
      });
      
      expect(result.allowed).toBe(false);
      expect(result.modifiedTurn?.decision.intent).toBe('falar_com_analista');
      expect(result.reason).toContain('Confiança');
    });

    it('bloqueia escrita sem confirmação', () => {
      const writeTurn: AgentTurn = {
        ...baseTurn,
        decision: { ...baseTurn.decision, intent: 'abrir_chamado' },
      };
      
      const result = applyGuardrails(writeTurn, {
        conversationState: 'agent',
        hasConfirmation: false,
        isWritingAction: true,
      });
      
      expect(result.allowed).toBe(false);
      expect(result.modifiedTurn?.decision.action).toContain('Aguardando confirmação');
    });

    it('permite escrita com confirmação', () => {
      const writeTurn: AgentTurn = {
        ...baseTurn,
        decision: { ...baseTurn.decision, intent: 'abrir_chamado' },
      };
      
      const result = applyGuardrails(writeTurn, {
        conversationState: 'agent',
        hasConfirmation: true,
        isWritingAction: true,
      });
      
      expect(result.allowed).toBe(true);
    });

    it('usa limiar configurável via env', async () => {
      vi.resetModules();
      vi.stubEnv('CONFIDENCE_THRESHOLD', '0.8');
      const { CONFIDENCE_THRESHOLD: threshold } = await import('@/agent/guardrails');
      expect(threshold).toBe(0.8);
      vi.unstubAllEnvs();
      vi.resetModules();
    });
  });

  describe('validateDecision', () => {
    it('valida decisão completa', () => {
      const result = validateDecision(baseTurn.decision);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejeita confiança fora do range', () => {
      const result = validateDecision({ ...baseTurn.decision, confidence: 1.5 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Confiança deve estar entre 0 e 1');
    });

    it('rejeita understood muito curto', () => {
      const result = validateDecision({ ...baseTurn.decision, understood: 'Ok' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Campo "understood" deve ter pelo menos 5 caracteres');
    });

    it('rejeita reasoning muito curto', () => {
      const result = validateDecision({ ...baseTurn.decision, reasoning: 'Sim' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Campo "reasoning" deve ter pelo menos 10 caracteres');
    });
  });
});