export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function utcDay(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}
