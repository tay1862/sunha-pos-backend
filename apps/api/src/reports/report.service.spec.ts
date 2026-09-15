import { describe, expect, it } from 'vitest';
import { ReportService, calculateNetSales } from './report.service.js';

describe('payment and refund reconciliation', () => {
  it('subtracts full refunds from net sales exactly once', () => {
    expect(
      calculateNetSales([{ totalAmount: 100000n }, { totalAmount: 50000n }], [{ amount: 50000n }]),
    ).toBe(100000n);
  });

  it('rejects an invalid or reversed report range', async () => {
    const service = new ReportService({} as never);
    await expect(service.sales('tenant-1', '2026-02-02T00:00:00Z', '2026-02-01T00:00:00Z')).rejects.toThrow('INVALID_REPORT_RANGE');
  });
});
