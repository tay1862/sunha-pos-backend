import { describe, expect, it } from 'vitest';
import { validatePrinterProfile } from './printer-profile';

const base = { id: 'p1', name: 'Receipt', transport: 'LAN' as const, address: '192.168.1.50:9100', paperWidth: 80 as const, autoPrint: true };
describe('printer profile and receipt queue validation', () => {
  it('accepts valid LAN profile', () => expect(() => validatePrinterProfile(base)).not.toThrow());
  it('rejects malformed LAN address and invalid paper width', () => {
    expect(() => validatePrinterProfile({ ...base, address: 'printer' })).toThrow('INVALID_LAN_ADDRESS');
    expect(() => validatePrinterProfile({ ...base, paperWidth: 70 as 58, address: 'ok:9100' })).toThrow('INVALID_PAPER_WIDTH');
  });
});
