// ÖKC (yeni nesil yazarkasa) sağlayıcı arayüzü.
// Gerçek entegrasyon (GMP3/TSM) gelince bu arayüzü uygulayan yeni bir sağlayıcı
// yazılır; iş mantığı (FiscalService) değişmez. "Tak-çalıştır" mimari.

export interface FiscalReceiptInput {
  orderId?: string;
  amount: number;
  payments: { method: string; amount: number }[];
  items: { name: string; quantity: number; lineTotal: number }[];
}

export interface FiscalReceiptResult {
  fiscalNo: string;
  zNo?: string;
  provider: string;
  status: 'OK' | 'HATA';
  message?: string;
}

export interface FiscalProvider {
  readonly name: string;
  printFiscalReceipt(input: FiscalReceiptInput): Promise<FiscalReceiptResult>;
}
