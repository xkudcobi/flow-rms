import { Logger } from '@nestjs/common';
import {
  FiscalProvider,
  FiscalReceiptInput,
  FiscalReceiptResult,
} from './fiscal.provider';

// --- Simülasyon: gerçek cihaz yokken mali fiş kesilmiş gibi davranır. ---
export class SimulationFiscalProvider implements FiscalProvider {
  readonly name = 'simulation';
  private readonly logger = new Logger('FiscalSim');

  async printFiscalReceipt(
    input: FiscalReceiptInput,
  ): Promise<FiscalReceiptResult> {
    // Gerçekçi görünen sahte bir mali fiş no üret.
    const now = new Date();
    const fiscalNo =
      'SIM' +
      now.toISOString().slice(2, 10).replace(/-/g, '') +
      Math.floor(1000 + Math.random() * 9000);
    const zNo = 'Z' + now.toISOString().slice(2, 10).replace(/-/g, '');
    this.logger.log(
      `[SİMÜLASYON] Mali fiş kesildi: ${fiscalNo} tutar=${input.amount}₺`,
    );
    return { fiscalNo, zNo, provider: this.name, status: 'OK' };
  }
}

// --- GMP3 iskeleti: gerçek yeni nesil yazarkasa (Ingenico/Hugin/Pavo…). ---
// Cihaz markası/modeli belirlenince o markanın GMP3/TSM SDK'sına göre doldurulur.
export class Gmp3FiscalProvider implements FiscalProvider {
  readonly name = 'gmp3';

  async printFiscalReceipt(
    _input: FiscalReceiptInput,
  ): Promise<FiscalReceiptResult> {
    // TODO: Seri/TCP üzerinden cihaza GMP3 mesajı gönder, mali fişi kestir,
    // dönen fiş no / Z no'yu oku. Cihaz SDK'sı gerektirir.
    throw new Error(
      'GMP3 ÖKC entegrasyonu henüz yapılandırılmadı. Cihaz marka/modeli gerekli.',
    );
  }
}

export function createFiscalProvider(): FiscalProvider {
  const kind = (process.env.FISCAL_PROVIDER || 'simulation').toLowerCase();
  if (kind === 'gmp3') return new Gmp3FiscalProvider();
  return new SimulationFiscalProvider();
}
