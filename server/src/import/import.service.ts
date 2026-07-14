import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type Row = Record<string, string>;
export interface ImportResult {
  type: string;
  imported: number;
  skipped: number;
  errors: string[];
}

// Türkçe/İngilizce başlık eş anlamlıları → tek anahtar.
const norm = (s: string) =>
  s.toLocaleLowerCase('tr').replace('i̇', 'i').replace(/[\s_]+/g, '').trim();

function pick(row: Row, aliases: string[]): string {
  for (const a of aliases) {
    const k = norm(a);
    if (row[k] != null && row[k] !== '') return row[k];
  }
  return '';
}

// Türkçe sayı ("1.234,56" / "12,5") ve düz sayı desteği.
function num(s: string): number {
  if (!s) return 0;
  let t = s.trim();
  if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '').replace(',', '.');
  else if (t.includes(',')) t = t.replace(',', '.');
  const n = parseFloat(t.replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  const t = s.trim();
  let d: Date | null = null;
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) d = new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0);
  else if ((m = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/)))
    d = new Date(+m[3], +m[2] - 1, +m[1], 12, 0, 0);
  if (!d || isNaN(d.getTime())) return null;
  // Saat verildiyse ekle (ör. "2026-07-10 19:30")
  const hm = t.match(/(\d{1,2}):(\d{2})/);
  if (hm) d.setHours(+hm[1], +hm[2], 0, 0);
  return d;
}

@Injectable()
export class ImportService {
  constructor(private readonly prisma: PrismaService) {}

  // Basit CSV çözümleyici: virgül veya noktalı virgül, tırnaklı alan, BOM.
  private parseCsv(text: string): Row[] {
    const clean = text.replace(/^﻿/, '');
    const lines = clean.split(/\r?\n/).filter((l) => l.trim() !== '');
    if (lines.length < 2) return [];
    const delim = (lines[0].match(/;/g)?.length || 0) >= (lines[0].match(/,/g)?.length || 0) ? ';' : ',';
    const splitLine = (line: string): string[] => {
      const out: string[] = [];
      let cur = '';
      let inq = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inq) {
          if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (c === '"') inq = false;
          else cur += c;
        } else if (c === '"') inq = true;
        else if (c === delim) { out.push(cur); cur = ''; }
        else cur += c;
      }
      out.push(cur);
      return out.map((x) => x.trim());
    };
    const headers = splitLine(lines[0]).map(norm);
    return lines.slice(1).map((line) => {
      const cells = splitLine(line);
      const row: Row = {};
      headers.forEach((h, i) => (row[h] = cells[i] ?? ''));
      return row;
    });
  }

  async run(type: string, csv: string, userId: string): Promise<ImportResult> {
    if (!csv?.trim()) throw new BadRequestException('Boş dosya');
    const rows = this.parseCsv(csv);
    if (!rows.length) throw new BadRequestException('Satır bulunamadı (başlık + veri gerekli)');
    switch (type) {
      case 'products': return this.products(rows);
      case 'customers': return this.customers(rows);
      case 'stock': return this.stock(rows);
      case 'sales': return this.sales(rows, userId);
      default: throw new BadRequestException('Geçersiz içe aktarma türü');
    }
  }

  private async products(rows: Row[]): Promise<ImportResult> {
    const res: ImportResult = { type: 'products', imported: 0, skipped: 0, errors: [] };
    const catCache = new Map<string, string>();
    const ensureCategory = async (name: string): Promise<string> => {
      const key = name || 'Genel';
      if (catCache.has(key)) return catCache.get(key)!;
      let cat = await this.prisma.category.findFirst({ where: { name: key } });
      if (!cat) cat = await this.prisma.category.create({ data: { name: key } });
      catCache.set(key, cat.id);
      return cat.id;
    };
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const name = pick(r, ['name', 'ad', 'isim', 'ürün', 'urun']);
      const price = num(pick(r, ['price', 'fiyat', 'tutar']));
      if (!name) { res.skipped++; continue; }
      try {
        const exists = await this.prisma.product.findFirst({ where: { name } });
        if (exists) { res.skipped++; continue; }
        const categoryId = await ensureCategory(pick(r, ['category', 'kategori']));
        const station = (pick(r, ['station', 'istasyon']) || 'MUTFAK').toUpperCase();
        await this.prisma.product.create({ data: { name, price, categoryId, station } });
        res.imported++;
      } catch (e: any) {
        res.errors.push(`Satır ${i + 2}: ${e.message}`);
      }
    }
    return res;
  }

  private async customers(rows: Row[]): Promise<ImportResult> {
    const res: ImportResult = { type: 'customers', imported: 0, skipped: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const name = pick(r, ['name', 'ad', 'isim', 'müşteri', 'musteri', 'adsoyad']);
      if (!name) { res.skipped++; continue; }
      const phone = pick(r, ['phone', 'telefon', 'tel', 'gsm']) || null;
      try {
        if (phone) {
          const dup = await this.prisma.customer.findFirst({ where: { phone } });
          if (dup) { res.skipped++; continue; }
        }
        const birthday = parseDate(pick(r, ['birthday', 'doğumgünü', 'dogumgunu', 'dogum', 'dogumtarihi']));
        await this.prisma.customer.create({
          data: { name, phone, birthday, note: pick(r, ['note', 'not']) || null },
        });
        res.imported++;
      } catch (e: any) {
        res.errors.push(`Satır ${i + 2}: ${e.message}`);
      }
    }
    return res;
  }

  private async stock(rows: Row[]): Promise<ImportResult> {
    const res: ImportResult = { type: 'stock', imported: 0, skipped: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const name = pick(r, ['name', 'ad', 'isim', 'malzeme', 'ürün', 'urun']);
      if (!name) { res.skipped++; continue; }
      try {
        const exists = await this.prisma.stockItem.findFirst({ where: { name } });
        if (exists) { res.skipped++; continue; }
        await this.prisma.stockItem.create({
          data: {
            name,
            unit: pick(r, ['unit', 'birim']) || 'adet',
            quantity: num(pick(r, ['quantity', 'miktar', 'adet', 'stok'])),
            criticalLevel: num(pick(r, ['critical', 'kritik', 'kritikseviye', 'min'])),
          },
        });
        res.imported++;
      } catch (e: any) {
        res.errors.push(`Satır ${i + 2}: ${e.message}`);
      }
    }
    return res;
  }

  // Geçmiş satışlar → kapalı adisyon + kalem + ödeme (öngörü/analiz motorunu besler).
  private async sales(rows: Row[], userId: string): Promise<ImportResult> {
    const res: ImportResult = { type: 'sales', imported: 0, skipped: 0, errors: [] };
    const methods = ['NAKIT', 'KREDI_KARTI', 'YEMEK_KARTI', 'ACIK_HESAP'];

    // OrderItem.productId zorunlu → ürünü bul/oluştur (pasif, menüyü kirletmez).
    let importCatId: string | null = null;
    const prodCache = new Map<string, { id: string; price: number }>();
    const ensureProduct = async (name: string, unitPrice: number) => {
      if (prodCache.has(name)) return prodCache.get(name)!;
      let p = await this.prisma.product.findFirst({ where: { name } });
      if (!p) {
        if (!importCatId) {
          const cat =
            (await this.prisma.category.findFirst({ where: { name: 'İçe Aktarma' } })) ||
            (await this.prisma.category.create({ data: { name: 'İçe Aktarma', active: false } }));
          importCatId = cat.id;
        }
        p = await this.prisma.product.create({
          data: { name, price: unitPrice, categoryId: importCatId, active: false },
        });
      }
      const v = { id: p.id, price: p.price };
      prodCache.set(name, v);
      return v;
    };

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const date = parseDate(pick(r, ['date', 'tarih', 'gün', 'gun']));
      const amount = num(pick(r, ['amount', 'tutar', 'ciro', 'toplam']));
      if (!date || amount <= 0) { res.skipped++; continue; }
      try {
        const qty = Math.max(1, Math.round(num(pick(r, ['quantity', 'adet', 'miktar'])) || 1));
        const productName = pick(r, ['product', 'ürün', 'urun']) || 'Geçmiş Satış';
        const unitPrice = Math.round((amount / qty) * 100) / 100;
        let method = (pick(r, ['method', 'ödeme', 'odeme', 'yöntem', 'yontem']) || 'NAKIT').toUpperCase();
        if (!methods.includes(method)) method = 'NAKIT';
        const prod = await ensureProduct(productName, unitPrice);
        await this.prisma.order.create({
          data: {
            type: 'MASA',
            status: 'KAPANDI',
            openedById: userId,
            createdAt: date,
            closedAt: date,
            note: 'İçe aktarılan geçmiş satış',
            items: {
              create: {
                productId: prod.id,
                nameSnapshot: productName,
                unitPrice,
                quantity: qty,
                status: 'SERVIS',
              },
            },
            payments: {
              create: { method, amount, createdById: userId },
            },
          },
        });
        res.imported++;
      } catch (e: any) {
        res.errors.push(`Satır ${i + 2}: ${e.message}`);
      }
    }
    return res;
  }
}
