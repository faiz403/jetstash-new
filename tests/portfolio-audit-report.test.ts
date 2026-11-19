import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildPortfolioAudit } from '@/lib/portfolio-data-quality';
import { renderPortfolioAuditReport } from '@/lib/portfolio-audit-report';

afterEach(() => vi.unstubAllEnvs());
const search = { settledThrough: '2026-09-29', periods: {} };

describe('current portfolio report', () => {
  it('reports the actual pause and missing handoffs instead of obsolete October migration conclusions', () => {
    vi.stubEnv('NEXT_PUBLIC_TRIPCOM_AFFILIATE_PAUSED', 'true');
    const rows = buildPortfolioAudit('2026-11-15');
    const report = renderPortfolioAuditReport(rows, '2026-11-15', search, true);
    expect(rows.every((row) => !row.monetised)).toBe(true);
    expect(report).toContain(`${rows.length} routes evaluated as of 2026-11-15`);
    expect(report).toContain('Trip.com affiliate pause in this run: **ON**');
    expect(report).toContain('0 have a configured monetised flight handoff');
    expect(report).not.toContain('Eight remaining fare gaps');
    expect(report).not.toContain('£522');
    expect(report).not.toContain('6 and 8 October');
    expect(report).toContain('not proof of zero searches or zero customer demand');
  });

  it('derives totals and source-review rows from the supplied inventory, including a subset', () => {
    const rows = buildPortfolioAudit('2026-11-15').filter((row) => row.reviewDueDate && row.reviewDueDate < '2026-11-15' && row.verificationSourceUrl).slice(0, 1);
    expect(rows).toHaveLength(1);
    const report = renderPortfolioAuditReport(rows, '2026-11-15', search, false);
    expect(report).toContain('1 routes evaluated');
    expect(report).toContain('Trip.com affiliate pause in this run: **OFF**');
    expect(report).toContain(rows[0].verificationSourceUrl!);
    expect(report).toContain('The bundled Search Console export is settled through **2026-09-29**');
    expect(report).toContain('does not re-verify any source or extend a review date');
    expect(report).not.toContain('89 public routes');
  });
});
