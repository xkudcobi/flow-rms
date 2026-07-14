import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'net';
import { PrismaService } from '../prisma/prisma.service';
import { buildKitchenTicket, buildReceipt, KitchenTicketData } from './escpos';

@Injectable()
export class PrintService {
  private readonly logger = new Logger('PrintService');

  constructor(private readonly prisma: PrismaService) {}

  // Bir siparişin mutfak fişlerini istasyon bazında üretir ve yazdırır.
  // onlyItemIds verilirse yalnız o kalemler (yeni gönderilenler) basılır.
  async printKitchenForOrder(orderId: string, onlyItemIds?: string[]) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, table: true },
    });
    if (!order) return { ok: false, reason: 'Sipariş bulunamadı', tickets: [] };

    let items = order.items.filter((i) => i.status !== 'IPTAL');
    if (onlyItemIds?.length) {
      items = items.filter((i) => onlyItemIds.includes(i.id));
    }
    if (items.length === 0) return { ok: true, tickets: [] };

    // İstasyona göre grupla
    const byStation = new Map<string, typeof items>();
    for (const it of items) {
      const arr = byStation.get(it.station) ?? [];
      arr.push(it);
      byStation.set(it.station, arr);
    }

    const tickets: { station: string; preview: string; sent: boolean }[] = [];
    for (const [station, list] of byStation) {
      const data: KitchenTicketData = {
        station,
        tableName: order.table?.name ?? null,
        orderType: order.type,
        createdAt: new Date(),
        items: list.map((i) => ({
          quantity: i.quantity,
          name: i.nameSnapshot,
          note: i.note,
        })),
      };
      const { buffer, text } = buildKitchenTicket(data);
      const sent = await this.sendToPrinter(buffer, station);
      if (!sent) {
        // Yazıcı yoksa önizlemeyi logla (kurulumda görünür).
        this.logger.log(`\n----- MUTFAK FİŞİ (${station}) -----\n${text}\n----------------------------`);
      }
      tickets.push({ station, preview: text, sent });
    }
    return { ok: true, tickets };
  }

  // Müşteri adisyon (satış) fişi. Yazıcı yoksa önizleme döner.
  async printReceiptForOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, table: true, payments: true },
    });
    if (!order) return { ok: false, reason: 'Sipariş bulunamadı', preview: '' };

    const activeItems = order.items.filter((i) => i.status !== 'IPTAL');
    const itemsTotal = activeItems.reduce(
      (s, i) => s + i.unitPrice * i.quantity,
      0,
    );
    let discount = 0;
    if (order.discountType === 'YUZDE')
      discount = (itemsTotal * order.discountValue) / 100;
    else if (order.discountType === 'TUTAR') discount = order.discountValue;
    discount = Math.min(discount, itemsTotal);
    const net = Math.round((itemsTotal - discount) * 100) / 100;

    const { buffer, text } = buildReceipt({
      businessName: process.env.BUSINESS_NAME || 'İŞLETME ADI',
      tableName: order.table?.name ?? null,
      orderType: order.type,
      items: activeItems.map((i) => ({
        quantity: i.quantity,
        name: i.nameSnapshot,
        lineTotal: i.unitPrice * i.quantity,
      })),
      itemsTotal: Math.round(itemsTotal * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      discountReason: order.discountReason,
      net,
      payments: order.payments.map((p) => ({
        method: p.method,
        amount: p.amount,
      })),
      createdAt: new Date(),
    });

    const sent = await this.sendToPrinter(buffer, 'RECEIPT');
    if (!sent) {
      this.logger.log(`\n----- ADİSYON FİŞİ -----\n${text}\n------------------------`);
    }
    return { ok: true, preview: text, sent };
  }

  // Ham ESC/POS buffer'ı ağ yazıcısına (raw TCP 9100) gönderir.
  // PRINTER_HOST tanımlı değilse gönderim yapılmaz (önizleme moduna düşer).
  // İleride istasyon bazlı yazıcı için PRINTER_HOST_<STATION> desteklenebilir.
  private sendToPrinter(buffer: Buffer, station: string): Promise<boolean> {
    const host =
      process.env[`PRINTER_HOST_${station}`] || process.env.PRINTER_HOST;
    const port = Number(
      process.env[`PRINTER_PORT_${station}`] || process.env.PRINTER_PORT || 9100,
    );
    if (!host) return Promise.resolve(false);

    return new Promise((resolve) => {
      const socket = new Socket();
      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        socket.destroy();
        resolve(ok);
      };
      socket.setTimeout(3000);
      socket.on('timeout', () => finish(false));
      socket.on('error', (e) => {
        this.logger.warn(`Yazıcı hatası (${host}:${port}): ${e.message}`);
        finish(false);
      });
      socket.connect(port, host, () => {
        socket.write(buffer, () => finish(true));
      });
    });
  }
}
