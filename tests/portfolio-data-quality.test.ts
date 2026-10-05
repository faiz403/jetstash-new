import { describe, expect, it } from 'vitest';
import { buildPortfolioAudit, summarizePortfolioAudit, validatePortfolioData } from '@/lib/portfolio-data-quality';

const AUDIT_DATE = '2026-10-04';

describe('portfolio data-quality contract', () => {
  it('has no structural validation errors', () => {
    const errors = validatePortfolioData(AUDIT_DATE).filter((issue) => issue.severity === 'error');
    expect(errors).toEqual([]);
  });

  it('audits every public route without a stale hard-coded total', () => {
    const rows = buildPortfolioAudit(AUDIT_DATE);
    expect(rows).toHaveLength(89);
    expect(new Set(rows.map((row) => row.slug)).size).toBe(rows.length);
  });

  it('keeps representative route states distinct', () => {
    const rows = new Map(buildPortfolioAudit(AUDIT_DATE).map((row) => [row.slug, row]));
    expect(rows.get('manchester-dubai')?.publicStatus).toBe('direct');
    expect(rows.get('leeds-bradford-amritsar')?.publicStatus).toBe('connecting');
    expect(rows.get('manchester-delhi')?.serviceEnded).toBe(true);
    expect(rows.get('london-gatwick-ahmedabad')?.publicStatus).toBe('unverified');
    expect(rows.get('london-gatwick-barcelona')?.originIata).toBe('LGW');
    expect(rows.get('manchester-islamabad')?.bookingHandoffType).not.toBeNull();
    expect(rows.get('london-gatwick-rome')?.bookingHandoffType).toBeNull();
    expect(rows.get('birmingham-antalya')?.currentFareKind).toBe('clean');
    expect(rows.get('glasgow-antalya')?.currentFareKind).toBe('self-transfer');
    expect(rows.get('london-heathrow-jeddah')?.currentFare).toBe(529);
    expect(rows.get('manchester-izmir')?.bookingHandoffType).toBeNull();
  });

  it('derives portfolio totals from the audit rows', () => {
    const summary = summarizePortfolioAudit(buildPortfolioAudit(AUDIT_DATE), AUDIT_DATE);
    expect(summary.totalPublicRoutes).toBe(89);
    expect(summary.currentFare + summary.noFare).toBe(89);
    expect(summary.cleanPrimary + summary.selfTransferPrimary).toBe(summary.currentFare);
    expect(summary.monetisedHandoff + summary.nonMonetisedFallback).toBe(89);
  });
});
