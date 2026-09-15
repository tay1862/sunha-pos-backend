import { calculateOrderTotals } from '@sunha/domain';

export type CatalogTax = { rateBasisPoints: number; mode: 'INCLUSIVE' | 'EXCLUSIVE' };
export function saleTotals(
  lines: Array<{ price: string; quantity: number }>,
  taxes: CatalogTax[],
  discount: string,
) {
  if (discount && !/^\d+$/.test(discount)) throw new Error('INVALID_DISCOUNT');
  if (new Set(taxes.map((tax) => tax.mode)).size > 1)
    throw new Error('MIXED_TAX_MODES_NOT_SUPPORTED');
  return calculateOrderTotals({
    lines: lines.map((line) => ({ unitPrice: line.price, quantity: String(line.quantity) })),
    discount: discount ? { type: 'FIXED', amount: discount } : undefined,
    tax: taxes.length
      ? {
          mode: taxes[0]!.mode,
          rateBasisPoints: taxes.reduce((sum, tax) => sum + tax.rateBasisPoints, 0),
        }
      : undefined,
  });
}
export function cashChange(total: string, tendered: string): string | null {
  if (!/^\d+$/.test(tendered) || BigInt(tendered) < BigInt(total)) return null;
  return (BigInt(tendered) - BigInt(total)).toString();
}
export const formatLak = (amount: string | bigint) => `${BigInt(amount).toLocaleString('en-US')} ₭`;
