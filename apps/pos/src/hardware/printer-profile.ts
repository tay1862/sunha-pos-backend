export type PrinterProfile = {
  id: string;
  name: string;
  transport: 'BLUETOOTH' | 'LAN';
  address: string;
  paperWidth: 58 | 80;
  autoPrint: boolean;
};
export function validatePrinterProfile(profile: PrinterProfile): void {
  if (!profile.name.trim() || !profile.address.trim()) throw new Error('PRINTER_PROFILE_INCOMPLETE');
  if (profile.transport === 'LAN' && !/^([^:]+):(\d{1,5})$/.test(profile.address)) throw new Error('INVALID_LAN_ADDRESS');
  if (![58, 80].includes(profile.paperWidth)) throw new Error('INVALID_PAPER_WIDTH');
}
