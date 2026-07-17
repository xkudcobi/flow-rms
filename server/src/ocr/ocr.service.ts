import { Injectable, Logger } from '@nestjs/common';

// Çıkarılan fatura taslağı — kullanıcı bunu forma alıp DÜZELTEREK kaydeder.
// Otomatik kayıt YOK: OCR düşük doğrulukludur, insan onayı şarttır.
export interface OcrDraft {
  provider: string;
  confidence: number; // 0-1 (kaba)
  supplierName?: string;
  invoiceNo?: string;
  invoiceDate?: string; // YYYY-MM-DD
  items: { name: string; quantity?: number; unitPrice?: number; vatRate?: number }[];
  rawText?: string;
  note?: string;
}

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  // OCR_PROVIDER=none | tesseract | ollama (varsayılan none → simülasyon)
  private readonly provider = process.env.OCR_PROVIDER || 'none';

  async extract(buffer: Buffer, _mime?: string): Promise<OcrDraft> {
    if (this.provider === 'tesseract') {
      try {
        const text = await this.runTesseract(buffer);
        return { ...parseInvoiceText(text), provider: 'tesseract', rawText: text };
      } catch (e: any) {
        this.logger.error(`Tesseract OCR hatası: ${e?.message ?? e}`);
        return this.emptyDraft('tesseract', 'OCR motoru çalıştırılamadı — alanları elle doldurun.');
      }
    }
    if (this.provider === 'ollama') {
      try {
        const text = await this.runOllamaVision(buffer);
        return { ...parseInvoiceText(text), provider: 'ollama', rawText: text };
      } catch (e: any) {
        this.logger.error(`Ollama vision OCR hatası: ${e?.message ?? e}`);
        return this.emptyDraft('ollama', 'Görüntü modeli yanıt vermedi — alanları elle doldurun.');
      }
    }
    // none: özellik kapalı — akış bozulmasın diye boş taslak + bilgilendirme.
    return this.emptyDraft(
      'none',
      'Fatura tarama kapalı (OCR_PROVIDER=none). Sunucuda OCR_PROVIDER=tesseract yaparak açabilirsiniz. Şimdilik alanları elle doldurun.',
    );
  }

  private emptyDraft(provider: string, note: string): OcrDraft {
    return { provider, confidence: 0, items: [], note };
  }

  // Tesseract.js ile görüntüden ham metin. Dil verisi ilk çalıştırmada indirilir
  // (tur), sonra önbelleğe alınır; tanıma tamamen yereldir.
  private async runTesseract(buffer: Buffer): Promise<string> {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('tur');
    try {
      const { data } = await worker.recognize(buffer);
      return data.text || '';
    } finally {
      await worker.terminate();
    }
  }

  // Ollama vision modeli (ör. llama3.2-vision) ile görüntüden metin/çıkarım.
  private async runOllamaVision(buffer: Buffer): Promise<string> {
    const url = process.env.AI_URL || 'http://localhost:11434';
    const model = process.env.OCR_OLLAMA_MODEL || 'llama3.2-vision';
    const res = await fetch(`${url}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt:
          'Bu bir alış faturası görselidir. İçindeki metni olduğu gibi düz metin olarak çıkar (tedarikçi adı, fatura no, tarih, kalemler, fiyatlar, KDV). Yorum ekleme.',
        images: [buffer.toString('base64')],
        stream: false,
      }),
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}`);
    const json: any = await res.json();
    return json.response || '';
  }
}

// --- Türkçe fatura metin ayrıştırıcı (kural tabanlı, kaba) -------------------

const MONTHS: Record<string, number> = {
  ocak: 1, şubat: 2, mart: 3, nisan: 4, mayıs: 5, haziran: 6,
  temmuz: 7, ağustos: 8, eylül: 9, ekim: 10, kasım: 11, aralık: 12,
};

export function parseInvoiceText(text: string): OcrDraft {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let invoiceNo: string | undefined;
  let invoiceDate: string | undefined;
  let supplierName: string | undefined;
  const items: OcrDraft['items'] = [];

  // Fatura no: "Fatura No", "Fiş No", "Belge No", "No" sonrası değer.
  const noRe = /(?:fatura|fiş|fis|belge)\s*(?:no|nu|nö)\s*[:.\-]?\s*([A-Z0-9\-\/]{3,})/i;
  // Tarih: 12.03.2026 / 12/03/2026 / 12-03-2026
  const dateNumRe = /(\b\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})\b/;
  // Tarih (yazılı ay): 12 Mart 2026
  const dateWordRe = /(\d{1,2})\s+([A-Za-zçğışöüÇĞİŞÖÜ]+)\s+(\d{4})/;

  for (const line of lines) {
    if (!invoiceNo) {
      const m = line.match(noRe);
      if (m) invoiceNo = m[1];
    }
    if (!invoiceDate) {
      const m = line.match(dateNumRe);
      if (m) {
        const dd = m[1].padStart(2, '0');
        const mm = m[2].padStart(2, '0');
        let yyyy = m[3];
        if (yyyy.length === 2) yyyy = '20' + yyyy;
        if (+mm >= 1 && +mm <= 12 && +dd >= 1 && +dd <= 31) {
          invoiceDate = `${yyyy}-${mm}-${dd}`;
        }
      } else {
        const w = line.match(dateWordRe);
        if (w) {
          const mo = MONTHS[w[2].toLocaleLowerCase('tr')];
          if (mo) invoiceDate = `${w[3]}-${String(mo).padStart(2, '0')}-${w[1].padStart(2, '0')}`;
        }
      }
    }

    // Kalem satırı: içinde fiyat gibi bir sayı (12,50 / 12.50) geçen satırlar.
    const priceMatch = line.match(/(\d{1,3}(?:[.\s]\d{3})*[.,]\d{2})/g);
    const looksLikeHeader =
      /toplam|topalm|ara toplam|kdv|genel|tutar|iskonto|indirim|nakit|kart/i.test(line);
    // Tarih ve etiket satırlarını (fatura no, adres, tel, vergi…) kalem sayma.
    const looksLikeMeta =
      dateNumRe.test(line) ||
      dateWordRe.test(line) ||
      /^(?:tarih|fatura|fiş|fis|belge|adres|tel|telefon|vergi|no|nu)\b/i.test(line);
    if (priceMatch && priceMatch.length && !looksLikeHeader && !looksLikeMeta) {
      const priceStr = priceMatch[priceMatch.length - 1];
      const unitPrice = parseTrNumber(priceStr);
      // İsim: satırdan sayısal/fiyat kısımlarını çıkar.
      let name = line
        .replace(/\d{1,3}(?:[.\s]\d{3})*[.,]\d{2}/g, ' ')
        .replace(/%\s*\d+/g, ' ')
        .replace(/\b\d+([.,]\d+)?\s*(adet|kg|gr|lt|ml|cl|ad)\b/gi, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
      // KDV oranı satırda geçiyorsa yakala.
      const vatM = line.match(/%\s*(\d{1,2})/);
      const vatRate = vatM ? Number(vatM[1]) : undefined;
      // Miktar: "2 adet", "3 kg" gibi.
      const qtyM = line.match(/\b(\d+(?:[.,]\d+)?)\s*(adet|kg|gr|lt|ml|cl|ad)\b/i);
      const quantity = qtyM ? parseTrNumber(qtyM[1]) : undefined;
      if (name.length >= 2 && unitPrice > 0) {
        items.push({ name, unitPrice, vatRate, quantity });
      }
    }
  }

  // Tedarikçi: en üstteki, fiyat/tarih içermeyen ilk anlamlı satır.
  supplierName = lines.find(
    (l) =>
      l.length >= 3 &&
      !dateNumRe.test(l) &&
      !/\d{2}[.,]\d{2}/.test(l) &&
      !/fatura|fiş|adres|tel|vergi|no\b/i.test(l),
  );

  const filled = [invoiceNo, invoiceDate, supplierName].filter(Boolean).length;
  const confidence = Math.min(1, (filled / 3) * 0.6 + Math.min(items.length, 5) / 5 * 0.4);

  return {
    provider: 'parser',
    confidence: Math.round(confidence * 100) / 100,
    supplierName,
    invoiceNo,
    invoiceDate,
    items,
  };
}

// "1.234,56" → 1234.56 ; "12,50" → 12.5 ; "12.50" → 12.5
function parseTrNumber(s: string): number {
  let x = s.replace(/\s/g, '');
  if (x.includes(',')) {
    x = x.replace(/\./g, '').replace(',', '.');
  }
  const n = parseFloat(x);
  return isNaN(n) ? 0 : n;
}
