export class Clock {
  now(): Date {
    return new Date();
  }
}

export const systemClock = new Clock();

export function getClock(): Clock {
  return systemClock;
}

export function setClockForTesting(clock: Clock) {
  Object.assign(systemClock, clock);
}