// e-Fatura / e-Arşiv sağlayıcı arayüzü. Gerçek entegrasyon GİB onaylı bir özel
// entegratör (Uyumsoft, Logo, EDM, QNB, Paraşüt…) REST API'siyle yapılır.

export interface EInvoiceInput {
  orderId?: string;
  accountId?: string;
  docType: 'EFATURA' | 'EARSIV';
  total: number;
  customerName?: string;
  items: { name: string; quantity: number; unitPrice: number }[];
}

export interface EInvoiceResult {
  uuid: string; // ETTN
  status: 'OLUSTURULDU' | 'KUYRUKTA' | 'GONDERILDI' | 'HATA';
  provider: string;
  message?: string;
}

export interface EInvoiceProvider {
  readonly name: string;
  createInvoice(input: EInvoiceInput): Promise<EInvoiceResult>;
}
