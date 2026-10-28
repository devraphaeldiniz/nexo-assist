import { describe, it, expect } from 'vitest';
import { calculateSLA, getPriorityFromImpactUrgency } from '@/services/sla';
import { Clock } from '@/lib/clock';

class MockClock extends Clock {
  private fixedDate: Date;
  constructor(date: Date) {
    super();
    this.fixedDate = date;
  }
  now(): Date {
    return new Date(this.fixedDate);
  }
}

describe('SLA Calculation', () => {
  const clock = new MockClock(new Date('2024-01-15T10:00:00')); // Segunda-feira 10h

  describe('calculateSLA', () => {
    it('calcula prazo crítico em 1 hora corrida', () => {
      const createdAt = new Date('2024-01-15T10:00:00');
      const result = calculateSLA(createdAt, 'critica', clock);
      
      expect(result.dueAt).toEqual(new Date('2024-01-15T11:00:00'));
      expect(result.isOverdue).toBe(false);
    });

    it('calcula prioridade alta em 4 horas úteis', () => {
      const createdAt = new Date('2024-01-15T10:00:00');
      const result = calculateSLA(createdAt, 'alta', clock);
      
      expect(result.dueAt).toEqual(new Date('2024-01-15T14:00:00'));
    });

    it('pula fim de semana para prioridade média/baixa', () => {
      const friday = new MockClock(new Date('2024-01-19T14:00:00')); // Sexta 14h
      const createdAt = new Date('2024-01-19T14:00:00');
      const result = calculateSLA(createdAt, 'media', friday);
      
      // 3 dias úteis = 24h úteis. Sexta 14h -> 4h hoje, seg 8h-18h (10h), ter 8h-18h (10h) = 24h
      // Deve cair na terça-feira 18h
      expect(result.dueAt.getDay()).toBe(2); // Terça
      expect(result.dueAt.getHours()).toBe(18);
    });

    it('marca como vencido se now > dueAt', () => {
      const createdAt = new Date('2024-01-15T10:00:00');
      const pastClock = new MockClock(new Date('2024-01-15T15:00:00'));
      const result = calculateSLA(createdAt, 'alta', pastClock);
      
      expect(result.isOverdue).toBe(true);
    });

    it('não marca como vencido se now < dueAt', () => {
      const createdAt = new Date('2024-01-15T10:00:00');
      const result = calculateSLA(createdAt, 'alta', clock);
      
      expect(result.isOverdue).toBe(false);
    });

    it('crítico ignora horário comercial (plantão 24h)', () => {
      const night = new MockClock(new Date('2024-01-15T22:00:00')); // 22h
      const createdAt = new Date('2024-01-15T22:00:00');
      const result = calculateSLA(createdAt, 'critica', night);
      
      expect(result.dueAt).toEqual(new Date('2024-01-15T23:00:00'));
    });
  });

  describe('getPriorityFromImpactUrgency', () => {
    it('equipe parada = crítica', () => {
      expect(getPriorityFromImpactUrgency('equipe', 'hoje')).toBe('critica');
      expect(getPriorityFromImpactUrgency('equipe', 'semana')).toBe('critica');
    });

    it('pessoa impedida hoje = alta', () => {
      expect(getPriorityFromImpactUrgency('pessoa', 'hoje')).toBe('alta');
    });

    it('pessoa impedida esta semana = média', () => {
      expect(getPriorityFromImpactUrgency('pessoa', 'semana')).toBe('media');
    });

    it('atrapalha = média', () => {
      expect(getPriorityFromImpactUrgency('atrapalha', 'hoje')).toBe('media');
      expect(getPriorityFromImpactUrgency('atrapalha', 'semana')).toBe('media');
    });

    it('melhoria sem urgência = baixa', () => {
      expect(getPriorityFromImpactUrgency('melhoria', 'sem_urgencia')).toBe('baixa');
      expect(getPriorityFromImpactUrgency('melhoria', 'semana')).toBe('baixa');
    });
  });
});