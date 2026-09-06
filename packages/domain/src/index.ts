import type { Money } from '@sunha/contracts';

export type Discount =
  | { type: 'FIXED'; amount: string }
  | { type: 'PERCENTAGE'; basisPoints: number };

export type Tax = { rateBasisPoints: number; mode: 'INCLUSIVE' | 'EXCLUSIVE' };

export type OrderInput = {
  lines: Array<{ unitPrice: string; quantity: string }>;
  discount?: Discount;
  tax?: Tax;
};

const QUANTITY_SCALE = 1_000n;
const BASIS_POINT_SCALE = 10_000n;
const INTEGER_PATTERN = /^-?\d+$/;
const QUANTITY_PATTERN = /^\d+(?:\.\d{1,3})?$/;

const parseInteger = (value: string, name: string): bigint => {
  if (!INTEGER_PATTERN.test(value)) throw new Error(`Invalid ${name}`);
  return BigInt(value);
};

const assertSameCurrency = (left: Money, right: Money): void => {
  if (left.currency !== right.currency) throw new Error('Currency mismatch');
};

const parseScaledQuantity = (value: string): bigint => {
  parseQuantity(value);
  const [whole = '0', fraction = ''] = value.split('.');
  return BigInt(whole) * QUANTITY_SCALE + BigInt(fraction.padEnd(3, '0'));
};

const formatScaledQuantity = (value: bigint): string => {
  const whole = value / QUANTITY_SCALE;
  const fraction = (value % QUANTITY_SCALE).toString().padStart(3, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
};

const roundHalfUp = (numerator: bigint, denominator: bigint): bigint => {
  if (denominator <= 0n) throw new Error('Denominator must be positive');
  const sign = numerator < 0n ? -1n : 1n;
  const absolute = numerator < 0n ? -numerator : numerator;
  return sign * ((absolute + denominator / 2n) / denominator);
};

const validateBasisPoints = (basisPoints: number): bigint => {
  if (!Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > 10_000) {
    throw new Error('Invalid basis points');
  }
  return BigInt(basisPoints);
};

export const addMoney = (left: Money, right: Money): Money => {
  assertSameCurrency(left, right);
  return {
    amount: (
      parseInteger(left.amount, 'money amount') + parseInteger(right.amount, 'money amount')
    ).toString(),
    currency: left.currency,
  };
};

export const subtractMoney = (left: Money, right: Money): Money => {
  assertSameCurrency(left, right);
  return {
    amount: (
      parseInteger(left.amount, 'money amount') - parseInteger(right.amount, 'money amount')
    ).toString(),
    currency: left.currency,
  };
};

export const multiplyMoney = (money: Money, quantity: string): Money => ({
  amount: roundHalfUp(
    parseInteger(money.amount, 'money amount') * parseScaledQuantity(quantity),
    QUANTITY_SCALE,
  ).toString(),
  currency: money.currency,
});

export const parseQuantity = (value: string): string => {
  if (!QUANTITY_PATTERN.test(value)) throw new Error('Invalid quantity');
  return formatScaledQuantity(parseScaledQuantityUnsafe(value));
};

const parseScaledQuantityUnsafe = (value: string): bigint => {
  const [whole = '0', fraction = ''] = value.split('.');
  return BigInt(whole) * QUANTITY_SCALE + BigInt(fraction.padEnd(3, '0'));
};

export const toBaseQuantity = (quantity: string, multiplier: string): string => {
  const product = parseScaledQuantity(quantity) * parseScaledQuantity(multiplier);
  return formatScaledQuantity(roundHalfUp(product, QUANTITY_SCALE));
};

export const applyOrderDiscount = (subtotal: string, discount: Discount): string => {
  const subtotalValue = parseInteger(subtotal, 'subtotal');
  if (subtotalValue < 0n) throw new Error('Subtotal cannot be negative');

  const calculated =
    discount.type === 'FIXED'
      ? parseInteger(discount.amount, 'discount amount')
      : roundHalfUp(subtotalValue * validateBasisPoints(discount.basisPoints), BASIS_POINT_SCALE);

  if (calculated < 0n) throw new Error('Discount cannot be negative');
  return (calculated > subtotalValue ? subtotalValue : calculated).toString();
};

export const calculateTax = (
  taxableAmount: string,
  rateBasisPoints: number,
  mode: Tax['mode'],
): string => {
  const amount = parseInteger(taxableAmount, 'taxable amount');
  if (amount < 0n) throw new Error('Taxable amount cannot be negative');
  const rate = validateBasisPoints(rateBasisPoints);
  const denominator = mode === 'INCLUSIVE' ? BASIS_POINT_SCALE + rate : BASIS_POINT_SCALE;
  return roundHalfUp(amount * rate, denominator).toString();
};

export const calculateOrderTotals = (
  input: OrderInput,
): { subtotal: string; discount: string; tax: string; total: string } => {
  const subtotal = input.lines.reduce((sum, line) => {
    const amount = parseInteger(line.unitPrice, 'unit price');
    if (amount < 0n) throw new Error('Unit price cannot be negative');
    return (
      sum + BigInt(multiplyMoney({ amount: line.unitPrice, currency: 'LAK' }, line.quantity).amount)
    );
  }, 0n);

  const discount = input.discount
    ? BigInt(applyOrderDiscount(subtotal.toString(), input.discount))
    : 0n;
  const discountedSubtotal = subtotal - discount;
  const tax = input.tax
    ? BigInt(calculateTax(discountedSubtotal.toString(), input.tax.rateBasisPoints, input.tax.mode))
    : 0n;
  const total = input.tax?.mode === 'EXCLUSIVE' ? discountedSubtotal + tax : discountedSubtotal;

  return {
    subtotal: subtotal.toString(),
    discount: discount.toString(),
    tax: tax.toString(),
    total: total.toString(),
  };
};
