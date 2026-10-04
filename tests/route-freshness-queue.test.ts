import { describe, expect, it } from 'vitest';
import { routes } from '@/data/routes';

const AS_OF = '2026-10-04';
const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

describe('route freshness queue policy', () => {
  it('reconciles the overdue and due-soon queue without mutating route data', () => {
    const overdue = routes.filter((route) => route.verification?.reviewDueDate && route.verification.reviewDueDate < AS_OF);
    const due7 = routes.filter((route) => route.verification?.reviewDueDate && route.verification.reviewDueDate >= AS_OF && route.verification.reviewDueDate <= addDays(AS_OF, 7));
    const due14 = routes.filter((route) => route.verification?.reviewDueDate && route.verification.reviewDueDate > addDays(AS_OF, 7) && route.verification.reviewDueDate <= addDays(AS_OF, 14));
    expect(overdue).toHaveLength(12);
    expect(due7).toHaveLength(27);
    expect(due14).toHaveLength(13);
    expect(overdue.length + due7.length + due14.length).toBe(52);
  });

  it('does not treat queue membership as evidence of a refreshed claim', () => {
    const dueSoon = routes.filter((route) => route.verification?.reviewDueDate && route.verification.reviewDueDate <= addDays(AS_OF, 14));
    expect(dueSoon.every((route) => route.verification?.verifiedDate)).toBe(true);
  });
});
