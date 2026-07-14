import { Logger } from '@nestjs/common';
import {
  EInvoiceInput,
  EInvoiceProvider,
  EInvoiceResult,
} from './einvoice.provider';
import { randomUUID } from 'crypto';

// --- Simülasyon: gerçek entegratör yokken fatura oluşturulmuş gibi davranır. ---
export class SimulationEInvoiceProvider implements EInvoiceProvider {
  readonly name = 'simulation';
  private readonly logger = new Logger('EInvoiceSim');

  async createInvoice(input: EInvoiceInput): Promise<EInvoiceResult> {
    const uuid = randomUUID().toUpperCase();
    this.logger.log(
      `[SİMÜLASYON] ${input.docType} oluşturuldu: ${uuid} tutar=${input.total}₺`,
    );
    return { uuid, status: 'GONDERILDI', provider: this.name };
  }
}

// --- Entegratör iskeleti: gerçek özel entegratör REST API'si. ---
// Entegratör ve API anahtarı belirlenince UBL-TR üretimi + REST çağrısı doldurulur.
export class EntegratorEInvoiceProvider implements EInvoiceProvider {
  readonly name = 'entegrator';

  async createInvoice(_input: EInvoiceInput): Promise<EInvoiceResult> {
    // TODO: UBL-TR belgesi üret, entegratör REST API'sine gönder (imza/mühür
    // entegratörde), dönen ETTN ve durumu döndür. API anahtarı gerektirir.
    throw new Error(
      'e-Fatura entegratörü henüz yapılandırılmadı. Entegratör + API anahtarı gerekli.',
    );
  }
}

export function createEInvoiceProvider(): EInvoiceProvider {
  const kind = (process.env.EINVOICE_PROVIDER || 'simulation').toLowerCase();
  if (kind === 'entegrator') return new EntegratorEInvoiceProvider();
  return new SimulationEInvoiceProvider();
}
