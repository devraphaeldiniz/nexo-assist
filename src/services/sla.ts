import { Clock, getClock } from '@/lib/clock';

export type Priority = 'critica' | 'alta' | 'media' | 'baixa';

export interface SLACalculation {
  dueAt: Date;
  isOverdue: boolean;
  businessHoursRemaining: number;
}

const BUSINESS_START_HOUR = 8;
const BUSINESS_END_HOUR = 18;

const PRIORITY_SLA_HOURS: Record<Priority, number> = {
  critica: 1,
  alta: 4,
  media: 24,
  baixa: 40,
};

const PRIORITY_SLA_BUSINESS_DAYS: Record<Priority, number> = {
  critica: 0,
  alta: 0,
  media: 3,
  baixa: 5,
};

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isBusinessHours(date: Date): boolean {
  const hour = date.getHours();
  return hour >= BUSINESS_START_HOUR && hour < BUSINESS_END_HOUR;
}

function startOfBusinessDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(BUSINESS_START_HOUR, 0, 0, 0);
  return result;
}

function endOfBusinessDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(BUSINESS_END_HOUR, 0, 0, 0);
  return result;
}

function addBusinessHours(start: Date, hours: number, _clock: Clock): Date {
  let current = new Date(start);
  let remainingHours = hours;

  if (isWeekend(current)) {
    current = nextBusinessDay(current);
  }

  if (!isBusinessHours(current)) {
    if (current.getHours() < BUSINESS_START_HOUR) {
      current = startOfBusinessDay(current);
    } else {
      current = startOfBusinessDay(nextBusinessDay(current));
    }
  }

  while (remainingHours > 0) {
    const endOfDay = endOfBusinessDay(current);
    const hoursLeftToday = (endOfDay.getTime() - current.getTime()) / (1000 * 60 * 60);

    if (remainingHours <= hoursLeftToday) {
      current = new Date(current.getTime() + remainingHours * 60 * 60 * 1000);
      remainingHours = 0;
    } else {
      remainingHours -= hoursLeftToday;
      current = startOfBusinessDay(nextBusinessDay(current));
    }
  }

  return current;
}

function nextBusinessDay(date: Date): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + 1);
  while (isWeekend(result)) {
    result.setDate(result.getDate() + 1);
  }
  return startOfBusinessDay(result);
}

export function calculateSLA(
  createdAt: Date,
  priority: Priority,
  clock: Clock = getClock()
): SLACalculation {
  const now = clock.now();
  let dueAt: Date;

  if (priority === 'critica') {
    dueAt = new Date(createdAt.getTime() + PRIORITY_SLA_HOURS.critica * 60 * 60 * 1000);
  } else {
    dueAt = addBusinessHours(createdAt, PRIORITY_SLA_HOURS[priority], clock);
  }

  const isOverdue = now > dueAt;

  let businessHoursRemaining = 0;
  if (!isOverdue) {
    if (priority === 'critica') {
      businessHoursRemaining = Math.max(0, (dueAt.getTime() - now.getTime()) / (1000 * 60 * 60));
    } else {
      let current = new Date(now);
      let remaining = 0;
      const target = new Date(dueAt);

      while (current < target) {
        if (isWeekend(current)) {
          current = nextBusinessDay(current);
          continue;
        }
        if (!isBusinessHours(current)) {
          if (current.getHours() < BUSINESS_START_HOUR) {
            current = startOfBusinessDay(current);
          } else {
            current = startOfBusinessDay(nextBusinessDay(current));
          }
          continue;
        }
        const endOfDay = endOfBusinessDay(current);
        const nextStep = endOfDay < target ? endOfDay : target;
        remaining += (nextStep.getTime() - current.getTime()) / (1000 * 60 * 60);
        current = nextStep;
      }
      businessHoursRemaining = Math.max(0, remaining);
    }
  }

  return { dueAt, isOverdue, businessHoursRemaining };
}

export function getPriorityFromImpactUrgency(impact: 'equipe' | 'pessoa' | 'atrapalha' | 'melhoria', urgency: 'hoje' | 'semana' | 'sem_urgencia'): Priority {
  if (impact === 'equipe') return 'critica';
  if (impact === 'pessoa' && urgency === 'hoje') return 'alta';
  if (impact === 'pessoa' && urgency === 'semana') return 'media';
  if (impact === 'atrapalha') return 'media';
  return 'baixa';
}

export function getSLAHours(priority: Priority): number {
  return PRIORITY_SLA_HOURS[priority];
}

export function getSLABusinessDays(priority: Priority): number {
  return PRIORITY_SLA_BUSINESS_DAYS[priority];
}