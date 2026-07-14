// Minimal ESC/POS fiş oluşturucu. Termal yazıcılar (80mm) için standart komutlar.
// Gerçek yazıcı bağlanınca buffer ham TCP (port 9100) veya USB ile gönderilir.

const ESC = 0x1b;
const GS = 0x1d;

class EscPosBuilder {
  private chunks: Buffer[] = [];

  raw(bytes: number[]) {
    this.chunks.push(Buffer.from(bytes));
    return this;
  }
  init() {
    return this.raw([ESC, 0x40]);
  }
  align(a: 'left' | 'center' | 'right') {
    return this.raw([ESC, 0x61, a === 'center' ? 1 : a === 'right' ? 2 : 0]);
  }
  bold(on: boolean) {
    return this.raw([ESC, 0x45, on ? 1 : 0]);
  }
  size(double: boolean) {
    return this.raw([GS, 0x21, double ? 0x11 : 0x00]);
  }
  text(s: string) {
    // Türkçe karakterler için CP857 ideal; sadeleştirmek adına ASCII'ye indiriyoruz.
    this.chunks.push(Buffer.from(deburr(s), 'ascii'));
    return this;
  }
  line(s = '') {
    return this.text(s + '\n');
  }
  feed(n = 1) {
    return this.raw(new Array(n).fill(0x0a));
  }
  cut() {
    return this.raw([GS, 0x56, 0x00]);
  }
  build(): Buffer {
    return Buffer.concat(this.chunks);
  }
}

function deburr(s: string): string {
  const map: Record<string, string> = {
    ç: 'c', Ç: 'C', ğ: 'g', Ğ: 'G', ı: 'i', İ: 'I',
    ö: 'o', Ö: 'O', ş: 's', Ş: 'S', ü: 'u', Ü: 'U',
  };
  return s.replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => map[c] || c);
}

const METHOD_LABEL: Record<string, string> = {
  NAKIT: 'Nakit',
  KREDI_KARTI: 'Kredi Kartı',
  YEMEK_KARTI: 'Yemek Kartı',
  ACIK_HESAP: 'Açık Hesap',
};

export interface ReceiptData {
  businessName: string;
  tableName: string | null;
  orderType: string;
  items: { quantity: number; name: string; lineTotal: number }[];
  itemsTotal: number;
  discount: number;
  discountReason?: string | null;
  net: number;
  payments: { method: string; amount: number }[];
  createdAt?: Date;
}

const money = (n: number) =>
  n.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' TL';

// 32 karakter genişlikte "sol .... sağ" satırı
function row(left: string, right: string, width = 32): string {
  const l = left.slice(0, width - right.length - 1);
  const pad = Math.max(1, width - l.length - right.length);
  return l + ' '.repeat(pad) + right;
}

// Müşteri adisyon (satış) fişi. Bilgi amaçlıdır; mali fiş ÖKC'den kesilir (Faz 2).
export function buildReceipt(data: ReceiptData): { buffer: Buffer; text: string } {
  const b = new EscPosBuilder();
  const dt = (data.createdAt ?? new Date()).toLocaleString('tr-TR');
  const header =
    data.orderType === 'MASA' ? `Masa: ${data.tableName ?? '-'}` : data.orderType;

  b.init()
    .align('center')
    .bold(true)
    .size(true)
    .line(data.businessName)
    .size(false)
    .bold(false)
    .line('- - - - - - - - - - - - - - - -')
    .align('left')
    .line(header)
    .line(dt)
    .line('--------------------------------');

  for (const it of data.items) {
    b.line(`${it.quantity} x ${it.name}`);
    b.line(row('', money(it.lineTotal)));
  }
  b.line('--------------------------------');
  b.line(row('Ara Toplam', money(data.itemsTotal)));
  if (data.discount > 0)
    b.line(row(`İndirim${data.discountReason ? ' (' + data.discountReason + ')' : ''}`, '-' + money(data.discount)));
  b.bold(true).size(true).line(row('TOPLAM', money(data.net))).size(false).bold(false);
  b.line('--------------------------------');
  for (const p of data.payments) {
    b.line(row(METHOD_LABEL[p.method] || p.method, money(p.amount)));
  }
  b.feed(1).align('center').line('Teşekkür ederiz!').feed(3).cut();

  // Metin önizleme (yazıcı yokken)
  const L: string[] = [];
  L.push('        ' + data.businessName);
  L.push('--------------------------------');
  L.push(header + '   ' + dt);
  L.push('--------------------------------');
  for (const it of data.items) {
    L.push(row(`${it.quantity} x ${it.name}`, money(it.lineTotal)));
  }
  L.push('--------------------------------');
  L.push(row('Ara Toplam', money(data.itemsTotal)));
  if (data.discount > 0)
    L.push(row('Indirim', '-' + money(data.discount)));
  L.push(row('TOPLAM', money(data.net)));
  L.push('--------------------------------');
  for (const p of data.payments) {
    L.push(row(METHOD_LABEL[p.method] || p.method, money(p.amount)));
  }
  L.push('        Tesekkur ederiz!');

  return { buffer: b.build(), text: L.join('\n') };
}

export interface KitchenTicketData {
  station: string;
  tableName: string | null;
  orderType: string;
  items: { quantity: number; name: string; note?: string | null }[];
  createdAt?: Date;
}

// Bir istasyon için mutfak fişi. Hem yazıcı buffer'ı hem de metin önizlemesi döner.
export function buildKitchenTicket(data: KitchenTicketData): {
  buffer: Buffer;
  text: string;
} {
  const b = new EscPosBuilder();
  const time = (data.createdAt ?? new Date()).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const header =
    data.orderType === 'MASA'
      ? `MASA ${data.tableName ?? '-'}`
      : data.orderType;

  b.init()
    .align('center')
    .bold(true)
    .size(true)
    .line(data.station)
    .size(false)
    .line('--------------------------------')
    .align('left')
    .bold(true)
    .line(header)
    .bold(false)
    .line(`Saat: ${time}`)
    .line('--------------------------------');

  for (const it of data.items) {
    b.bold(true).size(true).line(`${it.quantity} x ${it.name}`).size(false).bold(false);
    if (it.note) b.line(`   >> ${it.note}`);
  }

  b.line('--------------------------------').feed(3).cut();

  // Metin önizleme (yazıcı yokken göstermek/loglamak için)
  const lines: string[] = [];
  lines.push(`*** ${data.station} ***`);
  lines.push(header + `   (${time})`);
  lines.push('--------------------------------');
  for (const it of data.items) {
    lines.push(`${it.quantity} x ${it.name}`);
    if (it.note) lines.push(`   >> ${it.note}`);
  }

  return { buffer: b.build(), text: lines.join('\n') };
}
