import { describe, expect, it } from 'vitest';
import { calculateOrderTotals, goldenOrderFixtures } from '../src/index.js';

describe('golden order fixtures', () => {
  for (const fixture of goldenOrderFixtures) {
    it(fixture.name, () => expect(calculateOrderTotals(fixture.input)).toEqual(fixture.expected));
  }
});
