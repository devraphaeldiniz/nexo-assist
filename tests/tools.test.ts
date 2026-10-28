import { describe, it, expect } from 'vitest';
import {
  buscarCentralDeAjuda,
  perguntarAoUsuario,
} from '@/agent/tools';
import { AgentTurnSchema } from '@/agent/decision';

describe('Agent Tools & Decision', () => {
  describe('Decision Schema', () => {
    it('valida turno válido do agent', () => {
      const validTurn = {
        message: 'Encontrei estas informações sobre reset de senha.',
        ui: {
          kind: 'options' as const,
          question: 'Isso resolveu sua dúvida?',
          options: ['Sim, obrigado', 'Não, preciso de mais ajuda'],
        },
        decision: {
          intent: 'duvida' as const,
          understood: 'Usuário quer saber como resetar sua senha',
          action: 'Apresentar artigo da central de ajuda',
          confidence: 0.95,
          reasoning: 'Pergunta clássica de reset de senha encontrada na base de conhecimento',
          rulesApplied: ['Resolução sem fila', 'Base de conhecimento'],
        },
      };

      const parsed = AgentTurnSchema.safeParse(validTurn);
      expect(parsed.success).toBe(true);
    });

    it('rejeita turno sem reasoning ou com confidence fora do range', () => {
      const invalidTurn = {
        message: 'Teste',
        decision: {
          intent: 'duvida',
          understood: 'curto',
          action: 'ação',
          confidence: 1.5, // inválido (> 1)
          reasoning: '', // inválido (vazio)
          rulesApplied: [],
        },
      };

      const parsed = AgentTurnSchema.safeParse(invalidTurn);
      expect(parsed.success).toBe(false);
    });
  });

  describe('buscarCentralDeAjuda Tool', () => {
    it('possui id e descrição corretos', () => {
      expect(buscarCentralDeAjuda.id).toBe('buscar_central_de_ajuda');
      expect(buscarCentralDeAjuda.description).toContain('central de ajuda');
    });

    it('executa busca e retorna artigos', async () => {
      const execute = buscarCentralDeAjuda.execute;
      expect(execute).toBeDefined();
      if (!execute) return;

      const result = await execute({ query: 'senha' }, {} as any);
      expect(result).toBeDefined();
      if (result && 'articles' in result) {
        expect(result.success).toBe(true);
        expect(result.articles.length).toBeGreaterThan(0);
      }
    });
  });

  describe('perguntarAoUsuario Tool', () => {
    it('formata pergunta com opções estruturadas', async () => {
      const execute = perguntarAoUsuario.execute;
      expect(execute).toBeDefined();
      if (!execute) return;

      const result = await execute({
        pergunta: 'Você deseja abrir um chamado?',
        opcoes: ['Sim', 'Não', 'Ver outros chamados'],
      }, {} as any);

      expect(result).toBeDefined();
      if (result && 'ui' in result) {
        expect(result.success).toBe(true);
        expect(result.ui?.kind).toBe('options');
        expect(result.ui?.question).toBe('Você deseja abrir um chamado?');
        expect(result.ui?.options).toHaveLength(3);
      }
    });
  });
});
